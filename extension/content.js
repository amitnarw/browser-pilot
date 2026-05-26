(function() {
  "use strict";

  var overlay = null;
  var badge = null;
  var lastActiveState = null;
  var currentTaskName = "";
  var currentActionCount = 0;

  console.log("[BrowserPilot] Content script loaded on " + window.location.href);

  // ─── Inject Styles ────────────────────────────────────────────────────

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
    "  max-width: 360px;",
    "}",
    ".bp-bar-dot {",
    "  width: 8px; height: 8px; border-radius: 50%; background: #22d3ee;",
    "  animation: bp-pulse 1.5s ease-in-out infinite; flex-shrink: 0;",
    "  box-shadow: 0 0 6px rgba(34,211,238,0.5);",
    "}",
    ".bp-bar-info { flex: 1; min-width: 0; }",
    ".bp-bar-title { font-weight: 600; font-size: 11px; color: #e2e8f0; }",
    ".bp-bar-status { font-size: 10px; color: #38bdf8; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".bp-bar-btn {",
    "  padding: 6px 12px; background: rgba(56, 189, 248, 0.12);",
    "  border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px;",
    "  color: #38bdf8; font-size: 11px; font-weight: 600;",
    "  cursor: pointer; white-space: nowrap; font-family: inherit; flex-shrink: 0;",
    "}",
    ".bp-bar-btn:hover { background: rgba(56, 189, 248, 0.2); }",
    ".bp-bar-takeover {",
    "  padding: 6px 10px; background: rgba(239, 68, 68, 0.12);",
    "  border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;",
    "  color: #fca5a5; font-size: 11px; font-weight: 600;",
    "  cursor: pointer; white-space: nowrap; font-family: inherit; flex-shrink: 0;",
    "}",
    ".bp-bar-takeover:hover { background: rgba(239, 68, 68, 0.2); }",
    // Idle badge
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

  // ─── Create Blocking Overlay + Status Bar ─────────────────────────────

  function createOverlay() {
    if (overlay) return overlay;

    // Blocking overlay (transparent, covers page)
    overlay = document.createElement("div");
    overlay.className = "bp-overlay";

    // Status bar (bottom-right, on top of overlay)
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
    var status = document.createElement("div");
    status.className = "bp-bar-status";
    status.id = "bp-bar-status";
    status.textContent = "AI is working...";
    info.appendChild(title);
    info.appendChild(status);

    // Take Control button
    var takeoverBtn = document.createElement("button");
    takeoverBtn.className = "bp-bar-takeover";
    takeoverBtn.textContent = "Take Control";
    takeoverBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      takeControl();
    });

    // Open full → button
    var openBtn = document.createElement("button");
    openBtn.className = "bp-bar-btn";
    openBtn.innerHTML = "Open full \u2192";
    openBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      try { chrome.runtime.sendMessage({ type: "OPEN_SIDEBAR" }); } catch (err) {}
    });

    bar.appendChild(dot);
    bar.appendChild(info);
    bar.appendChild(takeoverBtn);
    bar.appendChild(openBtn);

    overlay.appendChild(bar);

    // CSS overlay with pointer-events:auto already blocks user mouse/touch.
    // No JS capture listeners — they also blocked AI tool events from CDP.

    document.body.appendChild(overlay);
    return overlay;
  }

  function updateStatus(taskName, actionCount) {
    var status = document.getElementById("bp-bar-status");
    if (status) {
      if (taskName) {
        status.textContent = taskName + (actionCount > 0 ? " (" + actionCount + " actions)" : "");
      } else {
        status.textContent = "AI is working... (" + actionCount + " actions)";
      }
    }
  }

  function removeOverlay() {
    if (!overlay) return;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  // ─── Idle Badge ───────────────────────────────────────────────────────

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

  // ─── Take Control ─────────────────────────────────────────────────────

  function takeControl() {
    console.log("[BrowserPilot] Take Control clicked");
    removeOverlay();
    showBadge();
    try { chrome.runtime.sendMessage({ type: "USER_TAKEOVER" }); } catch (e) {}
  }

  // ─── Message Listener ─────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === "LOCK_STATE") {
      var active = !!msg.active;
      currentTaskName = msg.taskName || currentTaskName;
      currentActionCount = (msg.actions || []).length;

      if (active) {
        removeBadge();
        if (lastActiveState !== true) {
          lastActiveState = true;
          console.log("[BrowserPilot] Session active — showing overlay");
          createOverlay();
        }
        updateStatus(currentTaskName, currentActionCount);
      } else {
        if (lastActiveState !== false) {
          lastActiveState = false;
          console.log("[BrowserPilot] Session ended — removing overlay, showing badge");
          removeOverlay();
          showBadge();
        }
      }
    }
  });

  // ─── Initial State Check ──────────────────────────────────────────────

  (async function() {
    try {
      var resp = await fetch("http://localhost:3026/sidebar/state");
      var state = await resp.json();
      lastActiveState = !!state.active;
      if (state.active) {
        currentTaskName = state.taskName || "";
        currentActionCount = (state.actions || []).length;
        createOverlay();
        updateStatus(currentTaskName, currentActionCount);
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
          removeBadge();
          createOverlay();
          updateStatus(currentTaskName, currentActionCount);
        }
      } catch {}
    }, 4000);
  })();
})();
