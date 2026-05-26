import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".browser-pilot");
const LOGS_DIR = path.join(CONFIG_DIR, "logs");
const LOG_FILE = path.join(LOGS_DIR, "server.log");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROTATED_FILES = 7;

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function rotateIfNeeded(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_LOG_SIZE) return;

    // Rotate: server.log -> server.log.1, .1 -> .2, etc.
    for (let i = MAX_ROTATED_FILES - 1; i >= 1; i--) {
      const oldFile = `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        if (i + 1 >= MAX_ROTATED_FILES) {
          fs.unlinkSync(oldFile);
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch {
    // Ignore rotation errors
  }
}

export function logToFile(message: string): void {
  try {
    rotateIfNeeded();
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // Ignore write errors
  }
}
