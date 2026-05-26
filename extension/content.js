(function() {
  "use strict";

  var overlay = null;
  var badge = null;
  var glowElements = {};
  var lastActiveState = null;
  var currentTaskName = "";
  var currentActionCount = 0;
  var lastActionType = "default";
  var idleTimer = null;
  var IDLE_TIMEOUT_MS = 3000;
  var stateCheckInterval = null;
  var STATE_CHECK_INTERVAL_MS = 5000;

  console.log("[BrowserPilot] Content script loaded on " + window.location.href);

  // ─── Load External Glow CSS ─────────────────────────────────────────────
  var glowCssLink = document.createElement("link");
  glowCssLink.rel = "stylesheet";
  glowCssLink.href = chrome.runtime.getURL("glow.css");
  document.head.appendChild(glowCssLink);

  // ─── Inject Inline Styles ───────────────────────────────────────────────
  var styleEl = document.createElement("style");
  styleEl.textContent = [
    "@keyframes bp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }",
    "@keyframes bp-spin { to { transform: rotate(360deg); } }",
    ".bp-overlay {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  background: rgba(0, 0, 0, 0.08); z-index: 2147483647;",
    "  display: flex; align-items: flex-end; justify-content: center;",
    "  pointer-events: auto; cursor: not-allowed;",
    "  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;",
    "}",
    ".bp-bar {",
    "  position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;",
    "  background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(12px);",
    "  border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px;",
    "  padding: 12px 16px; display: flex; align-items: center; gap: 12px;",
    "  font-family: Inter, -apple-system, sans-serif; font-size: 12px; color: #e2e8f0;",
    "  box-shadow: 0 4px 20px rgba(0,0,0,0.4); pointer-events: auto; cursor: default;",
    "  max-width: 420px;",
    "}",
    ".bp-bar-dot {",
    "  width: 8px; height: 8px; border-radius: 50%; background: #22d3ee;",
    "  animation: bp-pulse 1.5s ease-in-out infinite; flex-shrink: 0;",
    "  box-shadow: 0 0 6px rgba(34,211,238,0.5);",
    "}",
    ".bp-bar-info { flex: 1; min-width: 0; }",
    ".bp-bar-title { font-weight: 600; font-size: 11px; color: #e2e8f0; }",
    ".bp-bar-status { font-size: 10px; color: #38bdf8; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".bp-bar-takeover {",
    "  padding: 6px 10px; background: rgba(239, 68, 68, 0.12);",
    "  border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;",
    "  color: #fca5a5; font-size: 11px; font-weight: 600;",
    "  cursor: pointer; white-space: nowrap; font-family: inherit; flex-shrink: 0;",
    "}",
    ".bp-bar-takeover:hover { background: rgba(239, 68, 68, 0.2); }",
    ".bp-bar-btn {",
    "  padding: 6px 12px; background: rgba(56, 189, 248, 0.12);",
    "  border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px;",
    "  color: #38bdf8; font-size: 11px; font-weight: 600;",
    "  cursor: pointer; white-space: nowrap; font-family: inherit; flex-shrink: 0;",
    "}",
    ".bp-bar-btn:hover { background: rgba(56, 189, 248, 0.2); }",
    ".bp-badge {",
    "  position: fixed; bottom: 16px; right: 16px; z-index: 2147483646;",
    "  background: rgba(13, 17, 23, 0.92); backdrop-filter: blur(12px);",
    "  border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px;",
    "  padding: 10px 14px; display: flex; align-items: center; gap: 10px;",
    "  cursor: pointer; font-family: Inter, -apple-system, sans-serif;",
    "  font-size: 12px; color: #94a3b8; box-shadow: 0 2px 12px rgba(0,0,0,0.3);",
    "}",
    ".bp-badge:hover { border-color: rgba(56, 189, 248, 0.4); }",
    ".bp-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #475569; }",
    ".bp-badge-title { font-weight: 600; font-size: 11px; color: #e2e8f0; }",
    ".bp-badge-sub { font-size: 10px; color: #64748b; }",
  ].join("\n");
  document.head.appendChild(styleEl);

  // ─── Glow Management ────────────────────────────────────────────────────

  function createGlowElements() {
    if (Object.keys(glowElements).length > 0) return;
    var positions = ["top", "bottom", "left", "right"];
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var el = document.createElement("div");
      el.className = "bp-glow bp-glow-" + pos + " bp-glow-default bp-glow-pulse";
      el.id = "bp-glow-" + pos;
      document.body.appendChild(el);
      glowElements[pos] = el;
    }
  }

  function updateGlowColor(actionType) {
    var type = actionType || lastActionType || "default";
    lastActionType = type;
    var isIdle = type === "wait";
    var positions = ["top", "bottom", "left", "right"];
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var el = glowElements[pos];
      if (!el) continue;
      var classes = ["bp-glow", "bp-glow-" + pos];
      if (isIdle) {
        classes.push("bp-glow-idle", "bp-glow-idle-pulse");
      } else {
        classes.push("bp-glow-" + type, "bp-glow-pulse");
      }
      el.className = classes.join(" ");
    }
  }

  function setGlowIdle() {
    var positions = ["top", "bottom", "left", "right"];
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var el = glowElements[pos];
      if (!el) continue;
      el.className = "bp-glow bp-glow-" + pos + " bp-glow-idle bp-glow-idle-pulse";
    }
  }

  function removeGlowElements() {
    var positions = ["top", "bottom", "left", "right"];
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var el = glowElements[pos];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      glowElements[pos] = null;
    }
    glowElements = {};
  }

  // ─── Idle Timer ─────────────────────────────────────────────────────────

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function() {
      console.log("[BrowserPilot] Idle timeout — switching to gray glow");
      setGlowIdle();
    }, IDLE_TIMEOUT_MS);
  }

  function clearIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  // ─── Periodic State Check ──────────────────────────────────────────────
  // Checks server state periodically to handle SSE disconnections

  function startStateCheck() {
    if (stateCheckInterval) clearInterval(stateCheckInterval);
    stateCheckInterval = setInterval(async function() {
      if (lastActiveState !== true) return;
      try {
        var resp = await fetch("http://localhost:3026/sidebar/state");
        var state = await resp.json();
        if (!state.active) {
          console.log("[BrowserPilot] State check: session ended — removing overlay");
          lastActiveState = false;
          clearIdleTimer();
          removeOverlay();
          removeGlowElements();
          showBadge();
        }
      } catch (err) {
        // Server might be down — keep overlay
      }
    }, STATE_CHECK_INTERVAL_MS);
  }

  function stopStateCheck() {
    if (stateCheckInterval) {
      clearInterval(stateCheckInterval);
      stateCheckInterval = null;
    }
  }

  // ─── Create Overlay + Status Bar ────────────────────────────────────────

  function createOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "bp-overlay";

    var bar = document.createElement("div");
    bar.className = "bp-bar";
    bar.id = "bp-status-bar";

    var dot = document.createElement("div");
    dot.className = "bp-bar-dot";

    var info = document.createElement("div");
    info.className = "bp-bar-info";
    var title = document.createElement("div");
    title.className = "bp-bar-title";
    title.textContent = "BrowserPilot";

    var statusRow = document.createElement("div");
    statusRow.style.display = "flex";
    statusRow.style.alignItems = "center";

    var status = document.createElement("div");
    status.className = "bp-bar-status";
    status.id = "bp-bar-status";
    status.textContent = "AI is working...";

    var typingDots = document.createElement("div");
    typingDots.className = "bp-typing-dots";
    typingDots.id = "bp-typing-dots";
    typingDots.innerHTML = "<span></span><span></span><span></span>";
    typingDots.style.display = "none";

    statusRow.appendChild(status);
    statusRow.appendChild(typingDots);

    info.appendChild(title);
    info.appendChild(statusRow);

    // Stop button
    var stopBtn = document.createElement("button");
    stopBtn.className = "bp-stop-btn";
    stopBtn.textContent = "Stop BrowserPilot";
    stopBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      stopBrowserPilot();
    });

    // Open full sidebar button
    var openBtn = document.createElement("button");
    openBtn.className = "bp-bar-btn";
    openBtn.innerHTML = "Open full \u2192";
    openBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      try { chrome.runtime.sendMessage({ type: "OPEN_SIDEBAR" }); } catch (err) {}
    });

    bar.appendChild(dot);
    bar.appendChild(info);
    bar.appendChild(openBtn);
    bar.appendChild(stopBtn);

    overlay.appendChild(bar);

    document.body.appendChild(overlay);
    createGlowElements();
    startStateCheck();

    return overlay;
  }

  function updateStatus(taskName, actionCount, actionType) {
    var statusEl = document.getElementById("bp-bar-status");
    var typingDots = document.getElementById("bp-typing-dots");

    if (statusEl) {
      if (taskName) {
        statusEl.textContent = taskName + (actionCount > 0 ? " (" + actionCount + " actions)" : "");
      } else {
        statusEl.textContent = "AI is working... (" + actionCount + " actions)";
      }
    }

    // Show typing dots when typing
    if (typingDots) {
      var showTyping = actionType === "type" || actionType === "keypress";
      typingDots.style.display = showTyping ? "inline-flex" : "none";
    }

    // Update glow color and reset idle timer
    updateGlowColor(actionType);
    resetIdleTimer();
  }

  function removeOverlay() {
    if (!overlay) return;
    stopStateCheck();
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  // ─── Stop BrowserPilot ──────────────────────────────────────────────────

  function stopBrowserPilot() {
    var confirmed = window.confirm(
      "Stop BrowserPilot?\n\n" +
      "This will end the current AI session and release control."
    );
    if (!confirmed) return;

    console.log("[BrowserPilot] Stop confirmed — sending stop signal");
    clearIdleTimer();
    removeOverlay();
    removeGlowElements();
    showBadge();

    try {
      chrome.runtime.sendMessage({ type: "STOP_BROWSER" });
    } catch (e) {}
  }

  // ─── Idle Badge ─────────────────────────────────────────────────────────

  function showBadge() {
    if (badge && document.body.contains(badge)) return;
    badge = document.createElement("div");
    badge.className = "bp-badge";
    badge.innerHTML = '<div class="bp-badge-dot"></div><div><div class="bp-badge-title">BrowserPilot</div><div class="bp-badge-sub">Ready</div></div>';
    badge.addEventListener("click", function(e) {
      e.stopPropagation();
      try { chrome.runtime.sendMessage({ type: "OPEN_SIDEBAR" }); } catch (err) {}
    });
    document.body.appendChild(badge);
  }

  function removeBadge() {
    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
    badge = null;
  }

  // ─── Take Control ───────────────────────────────────────────────────────

  function takeControl() {
    console.log("[BrowserPilot] Take Control clicked");
    clearIdleTimer();
    removeOverlay();
    removeGlowElements();
    showBadge();
    try { chrome.runtime.sendMessage({ type: "USER_TAKEOVER" }); } catch (e) {}
  }

  // ─── Message Listener ───────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === "LOCK_STATE") {
      var active = !!msg.active;
      currentTaskName = msg.taskName || currentTaskName;
      currentActionCount = (msg.actions || []).length;
      var actionType = msg.lastActionType || "default";
      var sessionStatus = msg.sessionStatus || "ready";

      if (active) {
        removeBadge();
        if (lastActiveState !== true) {
          lastActiveState = true;
          console.log("[BrowserPilot] Session active — showing overlay + glow");
          createOverlay();
        }
        updateStatus(currentTaskName, currentActionCount, actionType);
      } else {
        if (lastActiveState !== false) {
          lastActiveState = false;
          console.log("[BrowserPilot] Session ended — removing overlay + glow");
          clearIdleTimer();
          removeOverlay();
          removeGlowElements();
          showBadge();
        }
      }
    }
  });

  // ─── Initial State Check ────────────────────────────────────────────────

  (async function() {
    try {
      var resp = await fetch("http://localhost:3026/sidebar/state");
      var state = await resp.json();
      lastActiveState = !!state.active;
      if (state.active) {
        currentTaskName = state.taskName || "";
        currentActionCount = (state.actions || []).length;
        var lastAction = state.actions && state.actions.length > 0
          ? state.actions[state.actions.length - 1]
          : null;
        lastActionType = lastAction ? lastAction.type : "default";
        createOverlay();
        updateStatus(currentTaskName, currentActionCount, lastActionType);
      } else {
        showBadge();
      }
    } catch (err) {
      showBadge();
    }

    // Retry after 4s
    setTimeout(async function() {
      if (lastActiveState) return;
      try {
        var resp2 = await fetch("http://localhost:3026/sidebar/state");
        var state2 = await resp2.json();
        if (state2.active) {
          lastActiveState = true;
          currentTaskName = state2.taskName || "";
          currentActionCount = (state2.actions || []).length;
          var lastAction2 = state2.actions && state2.actions.length > 0
            ? state2.actions[state2.actions.length - 1]
            : null;
          lastActionType = lastAction2 ? lastAction2.type : "default";
          removeBadge();
          createOverlay();
          updateStatus(currentTaskName, currentActionCount, lastActionType);
        }
      } catch {}
    }, 4000);
  })();
})();
