import express, { Request, Response } from "express";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { logToFile } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = "1.0.0";
const CONFIG_DIR = path.join(os.homedir(), ".web-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

let HTTP_PORT = 3026;
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (config?.server?.port) {
      HTTP_PORT = config.server.port;
    }
  } catch {}
}

const RECORDINGS_DIR = path.join(CONFIG_DIR, "recordings");
const PID_FILE = path.join(CONFIG_DIR, "server.pid");

interface SidebarAction {
  text: string;
  type: string;
  timestamp: string;
}

interface SidebarState {
  active: boolean;
  taskName: string;
  actions: SidebarAction[];
}

interface SessionState {
  status: "idle" | "launching" | "ready" | "running" | "waiting" | "closing";
  taskName: string | null;
  lockOwner: "agent" | "user" | null;
  currentAction: string | null;
  startedAt: string | null;
}

interface SessionCommand {
  command: string;
  args: Record<string, unknown>;
  timestamp: string;
  frameIndex: number;
}

interface SessionData {
  taskName: string;
  startTime: string;
  endTime: string | null;
  durationMs: number;
  frameCount: number;
  commands: SessionCommand[];
}

const startTime = Date.now();
let currentTask: string | null = null;
let sessionId: string | null = null;
let sessionDir: string | null = null;
let sessionData: SessionData | null = null;
let commandCounter = 0;
let lastUserHaltTime = 0;

// ─── Log Buffer ──────────────────────────────────────────────────────────

const MAX_LOGS = 200;
const logBuffer: { timestamp: string; message: string }[] = [];

function addLog(message: string): void {
  const entry = { timestamp: new Date().toISOString(), message };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  log(message);
}

let sidebarState: SidebarState = {
  active: false,
  taskName: "",
  actions: [],
};

let sessionState: SessionState = {
  status: "idle",
  taskName: null,
  lockOwner: null,
  currentAction: null,
  startedAt: null,
};

// ─── SSE Channel ─────────────────────────────────────────────────────────

const sseClients: Set<Response> = new Set();

function broadcastState(): void {
  const lastAction = sidebarState.actions[sidebarState.actions.length - 1];
  const payload = JSON.stringify({
    lockOwner: sessionState.lockOwner,
    active: sidebarState.active,
    taskName: sidebarState.taskName,
    actions: sidebarState.actions.slice(-10),
    sessionStatus: sessionState.status,
    lastActionType: lastAction ? lastAction.type : null,
  });
  for (const client of sseClients) {
    try {
      client.write(`event: state\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

fs.writeFileSync(PID_FILE, String(process.pid));

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function log(msg: string): void {
  logToFile(msg);
}

function startSession(taskName: string): void {
  sessionId = "session-" + timestamp();
  sessionDir = path.join(RECORDINGS_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  commandCounter = 0;

  sessionData = {
    taskName: taskName || "Unnamed task",
    startTime: new Date().toISOString(),
    endTime: null,
    durationMs: 0,
    frameCount: 0,
    commands: [],
  };

  log("SESSION START: " + sessionData.taskName + " (" + sessionId + ")");
}

function endSession(): void {
  if (!sessionData || !sessionDir) return;

  sessionData.endTime = new Date().toISOString();
  sessionData.durationMs = Date.now() - new Date(sessionData.startTime).getTime();

  try {
    fs.writeFileSync(
      path.join(sessionDir, "session.json"),
      JSON.stringify(sessionData, null, 2)
    );

    let summary = "# Session Summary\n\n";
    summary += "- **Task:** " + sessionData.taskName + "\n";
    summary += "- **Start:** " + sessionData.startTime + "\n";
    summary += "- **End:** " + sessionData.endTime + "\n";
    summary += "- **Duration:** " + (sessionData.durationMs / 1000).toFixed(1) + "s\n";
    summary += "- **Frames:** " + sessionData.frameCount + "\n";
    summary += "- **Commands:** " + sessionData.commands.length + "\n\n";
    summary += "## Command Sequence\n\n";
    sessionData.commands.forEach((cmd, i) => {
      summary += (i + 1) + ". `" + cmd.command + "`";
      const args = cmd.args as Record<string, unknown>;
      if (args.url) summary += " -> " + args.url;
      if (args.taskName) summary += " (" + args.taskName + ")";
      summary += " [" + cmd.timestamp + "]\n";
    });

    fs.writeFileSync(path.join(sessionDir, "summary.md"), summary);
  } catch (err) {
    log("ERROR writing session files: " + (err as Error).message);
  }

  log("SESSION END: " + sessionData.taskName + " (" + commandCounter + " commands, " + sessionData.frameCount + " frames)");
  sessionData = null;
  sessionDir = null;
  sessionId = null;
}

function recordCommand(command: string, args?: Record<string, unknown>): void {
  if (!sessionData) return;
  commandCounter++;
  sessionData.commands.push({
    command,
    args: args || {},
    timestamp: new Date().toISOString(),
    frameIndex: sessionData.frameCount,
  });
}

// ─── HTTP Server ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "50mb" }));

app.use((_req: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/.identity", (_req: Request, res: Response) => {
  res.json({ identity: "web-mcp-server", version: VERSION });
});

// Serve extension files statically for the preview route
app.use("/extension", express.static(path.join(__dirname, "../../extension")));

// Preview Sandbox Route
app.get("/preview", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../extension/preview.html"));
});

app.get("/ping", (_req: Request, res: Response) => {
  res.json({ status: "ok", identity: "web-mcp-server" });
});

app.get("/status", (_req: Request, res: Response) => {
  res.json({
    sidebarActive: sidebarState.active,
    currentTask,
    uptime: Date.now() - startTime,
    sessionId,
    hasActiveSession: sessionData !== null,
    sessionState: sessionState.status,
    lastUserHaltTime,
  });
});

// ─── Session Endpoints ──────────────────────────────────────────────────

app.post("/session/start", (req: Request, res: Response) => {
  const { taskName } = req.body as { taskName?: string };
  const name = taskName || "AI Browser Task";

  sessionState = {
    status: "ready",
    taskName: name,
    lockOwner: "agent",
    currentAction: null,
    startedAt: new Date().toISOString(),
  };

  sidebarState = {
    active: true,
    taskName: name,
    actions: [{ text: "Starting task: " + name, type: "default", timestamp: new Date().toISOString() }],
  };

  if (!currentTask) {
    currentTask = name;
    startSession(name);
  }
  recordCommand("session_start", { taskName: name });

  addLog("SESSION START: " + name + " (status=ready, lockOwner=agent, active=true)");
  res.json({ success: true, sessionState });
  broadcastState();
});

app.post("/session/stop", (req: Request, res: Response) => {
  const { haltedByUser } = req.body as { haltedByUser?: boolean };
  if (haltedByUser) {
    lastUserHaltTime = Date.now();
  }

  sessionState = {
    status: "idle",
    taskName: null,
    lockOwner: null,
    currentAction: null,
    startedAt: null,
  };

  sidebarState = {
    active: false,
    taskName: "",
    actions: [],
  };

  recordCommand("session_stop");
  endSession();
  currentTask = null;

  addLog("SESSION STOP (status=idle, lockOwner=null, active=false)");
  res.json({ success: true });
  broadcastState();
});

app.post("/session/lock", (req: Request, res: Response) => {
  const { owner, action } = req.body as { owner?: "agent" | "user" | null; action?: string };
  if (owner !== undefined) sessionState.lockOwner = owner;
  if (action !== undefined) sessionState.currentAction = action;
  if (owner === "agent") sessionState.status = "running";
  if (owner === null) sessionState.status = "ready";
  addLog("SESSION LOCK: owner=" + owner + " action=" + action);
  res.json({ success: true });
  broadcastState();
});

app.get("/session/state", (_req: Request, res: Response) => {
  res.json(sessionState);
});

// ─── Sidebar Endpoints ───────────────────────────────────────────────────

app.post("/sidebar/start", (req: Request, res: Response) => {
  const { taskName } = req.body as { taskName?: string };
  const name = taskName || "AI Browser Task";

  sidebarState = {
    active: true,
    taskName: name,
    actions: [{ text: "Starting task: " + name, type: "default", timestamp: new Date().toISOString() }],
  };

  sessionState.lockOwner = "agent";
  sessionState.status = "running";
  sessionState.taskName = name;
  sessionState.startedAt = new Date().toISOString();

  if (!currentTask) {
    currentTask = name;
    startSession(name);
  }
  recordCommand("sidebar_start", { taskName: name });

  addLog("SIDEBAR START: " + name + " (active=true, lockOwner=agent)");
  res.json({ success: true });
  broadcastState();
});

app.post("/sidebar/end", (_req: Request, res: Response) => {
  sidebarState = {
    active: false,
    taskName: "",
    actions: [],
  };

  recordCommand("sidebar_end");
  endSession();
  currentTask = null;

  addLog("SIDEBAR END (active=false)");
  res.json({ success: true });
  broadcastState();
});

app.post("/sidebar/action", (req: Request, res: Response) => {
  const { text, type } = req.body as { text?: string; type?: string };

  if (sidebarState.active && text) {
    sidebarState.actions.push({
      text,
      type: type || "default",
      timestamp: new Date().toISOString(),
    });

    if (sidebarState.actions.length > 50) {
      sidebarState.actions = sidebarState.actions.slice(-50);
    }

    recordCommand("sidebar_action", { text, type });
    addLog("SIDEBAR ACTION: " + text + " (" + type + ")");
  }

  res.json({ success: true });
  broadcastState();
});

app.get("/sidebar/state", (_req: Request, res: Response) => {
  const lastAction = sidebarState.actions[sidebarState.actions.length - 1];
  res.json({
    ...sidebarState,
    lockOwner: sessionState.lockOwner,
    sessionStatus: sessionState.status,
    lastActionType: lastAction ? lastAction.type : null,
  });
});

// ─── SSE Endpoint ────────────────────────────────────────────────────────

app.get("/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send current state immediately on connection
  const currentState = JSON.stringify({
    lockOwner: sessionState.lockOwner,
    active: sidebarState.active,
    taskName: sidebarState.taskName,
    actions: sidebarState.actions.slice(-10),
    sessionStatus: sessionState.status,
  });
  res.write(`event: state\ndata: ${currentState}\n\n`);

  sseClients.add(res);
  log("SSE client connected (total: " + sseClients.size + ")");

  req.on("close", () => {
    sseClients.delete(res);
    log("SSE client disconnected (total: " + sseClients.size + ")");
  });
});

// ─── Sessions History ────────────────────────────────────────────────────

app.get("/sessions", (_req: Request, res: Response) => {
  try {
    const sessions: Record<string, unknown>[] = [];
    const entries = fs.readdirSync(RECORDINGS_DIR);
    entries.forEach((entry) => {
      const sessionFile = path.join(RECORDINGS_DIR, entry, "session.json");
      if (fs.existsSync(sessionFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
          sessions.push({
            id: entry,
            taskName: data.taskName,
            startTime: data.startTime,
            endTime: data.endTime,
            durationMs: data.durationMs,
            frameCount: data.frameCount,
            commandCount: data.commands.length,
          });
        } catch {
          // skip malformed
        }
      }
    });
    res.json({ sessions });
  } catch {
    res.json({ sessions: [] });
  }
});

// ─── Logs & Debug Endpoints ─────────────────────────────────────────────

app.get("/logs", (_req: Request, res: Response) => {
  const since = _req.query.since as string | undefined;
  let logs = logBuffer;
  if (since) {
    const sinceTime = new Date(since).getTime();
    logs = logBuffer.filter(l => new Date(l.timestamp).getTime() > sinceTime);
  }
  res.json({ logs, total: logBuffer.length });
});

app.get("/debug", (_req: Request, res: Response) => {
  res.json({
    uptime: Date.now() - startTime,
    server: {
      pid: process.pid,
      port: HTTP_PORT,
    },
    session: sessionState,
    sidebar: sidebarState,
    sseClients: sseClients.size,
    logCount: logBuffer.length,
    recentLogs: logBuffer.slice(-20),
  });
});

const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  log("HTTP server listening on port " + HTTP_PORT);
  log("Server ready. PID: " + process.pid);
});

process.on("SIGINT", () => {
  log("Shutting down...");
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});

process.on("SIGTERM", () => {
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});
