(function() {
  "use strict";

  var overlay = null;
  var sidebar = null;
  var idleBadge = null;
  var currentLockOwner = null;
  var currentTaskName = "";
  var currentActions = [];
  var lastActionCount = 0;
  var lastActiveState = null; // Track last active state to deduplicate

  console.log("[BrowserPilot] Content script loaded on " + window.location.href);

  // ─── Inject Styles ────────────────────────────────────────────────────

  var styleEl = document.createElement("style");
  styleEl.textContent = [
    "@keyframes bp-spin-outer { to { transform: rotate(360deg); } }",
    "@keyframes bp-spin-inner { to { transform: rotate(-360deg); } }",
    "@keyframes bp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }",
    "@keyframes bp-action-in { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }",
    ".bp-take-control-btn:hover { background: rgba(239, 68, 68, 0.25) !important; }",
  ].join("\n");
  document.head.appendChild(styleEl);

  // ─── SVG Icons ────────────────────────────────────────────────────────

  function getActionIcon(type) {
    switch (type) {
      case "navigate":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case "click":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M5 1v4M3 3l2 2 2-2M2 7v3h8V7" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case "type":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M2 3h8v6H2zM4 6h4" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case "scroll":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M6 2v8M3 7l3 3 3-3M3 5l3-3 3 3" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case "screenshot":
        return '<svg viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1" stroke="#38bdf8" stroke-width="1.5"/><circle cx="6" cy="6" r="2" stroke="#38bdf8" stroke-width="1.5"/></svg>';
      case "snapshot":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M2 2h8v8H2zM2 5h8M5 2v8" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case "drag":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6h8M8 3l3 3-3 3" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case "hover":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M6 2v3M6 9v1M2 6h3M7 6h3" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/></svg>';
      case "keypress":
        return '<svg viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="10" height="6" rx="1" stroke="#38bdf8" stroke-width="1.5"/><path d="M4 6h4" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/></svg>';
      case "script":
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M4 3L1 6l3 3M8 3l3 3-3 3" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      default:
        return '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2v8" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/></svg>';
    }
  }

  // ─── Overlay ──────────────────────────────────────────────────────────

  function createOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "browser-pilot-lock-overlay";
    overlay.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100vw",
      "height: 100vh",
      "background: rgba(0, 0, 0, 0.15)",
      "z-index: 2147483647",
      "display: flex",
      "flex-direction: column",
      "align-items: flex-end",
      "pointer-events: auto",
      "cursor: not-allowed",
    ].join(";");

    // ── Inline Sidebar Panel (right edge) ──
    sidebar = document.createElement("div");
    sidebar.id = "browser-pilot-sidebar";
    sidebar.style.cssText = [
      "width: 340px",
      "height: 100vh",
      "background: linear-gradient(180deg, #080f1e 0%, #050c19 100%)",
      "border-left: 1px solid rgba(56, 189, 248, 0.15)",
      "font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      "color: #e2e8f0",
      "display: flex",
      "flex-direction: column",
      "pointer-events: auto",
      "overflow: hidden",
      "box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5)",
    ].join(";");

    // Header
    var header = document.createElement("div");
    header.style.cssText = [
      "padding: 16px 20px",
      "border-bottom: 1px solid rgba(56, 189, 248, 0.1)",
      "display: flex",
      "align-items: center",
      "gap: 10px",
      "flex-shrink: 0",
    ].join(";");

    var logo = document.createElement("div");
    logo.style.cssText = [
      "width: 28px",
      "height: 28px",
      "background: linear-gradient(135deg, #38bdf8, #6366f1)",
      "border-radius: 8px",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "font-size: 11px",
      "font-weight: 700",
      "color: white",
    ].join(";");
    logo.textContent = "BP";

    var headerText = document.createElement("div");
    headerText.style.cssText = "flex: 1;";
    var headerTitle = document.createElement("div");
    headerTitle.style.cssText = "font-size: 13px; font-weight: 600;";
    headerTitle.textContent = "BrowserPilot";
    var headerSub = document.createElement("div");
    headerSub.style.cssText = "font-size: 10px; color: #64748b; margin-top: 1px;";
    headerSub.textContent = "AI agent active";
    headerText.appendChild(headerTitle);
    headerText.appendChild(headerSub);

    var spinnerWrap = document.createElement("div");
    spinnerWrap.style.cssText = "width: 18px; height: 18px; position: relative;";
    var spinnerOuter = document.createElement("div");
    spinnerOuter.style.cssText = [
      "position: absolute; top: 0; left: 0; width: 18px; height: 18px",
      "border: 1.5px solid rgba(56, 189, 248, 0.1); border-top-color: #38bdf8",
      "border-radius: 50%; animation: bp-spin-outer 1.4s linear infinite",
    ].join(";");
    var spinnerInner = document.createElement("div");
    spinnerInner.style.cssText = [
      "position: absolute; top: 3px; left: 3px; width: 12px; height: 12px",
      "border: 1.5px solid rgba(6, 182, 212, 0.1); border-bottom-color: #06b6d4",
      "border-radius: 50%; animation: bp-spin-inner 1s linear infinite",
    ].join(";");
    spinnerWrap.appendChild(spinnerOuter);
    spinnerWrap.appendChild(spinnerInner);

    header.appendChild(logo);
    header.appendChild(headerText);
    header.appendChild(spinnerWrap);

    // Status bar
    var statusBar = document.createElement("div");
    statusBar.style.cssText = [
      "display: flex", "align-items: center", "gap: 6px",
      "padding: 6px 12px", "margin: 12px 16px 0",
      "background: rgba(56, 189, 248, 0.06)",
      "border: 1px solid rgba(56, 189, 248, 0.12)", "border-radius: 6px",
      "flex-shrink: 0",
    ].join(";");
    var statusDot = document.createElement("div");
    statusDot.style.cssText = [
      "width: 5px", "height: 5px", "background: #22d3ee", "border-radius: 50%",
      "animation: bp-pulse 1.5s ease-in-out infinite",
    ].join(";");
    var statusText = document.createElement("div");
    statusText.style.cssText = "font-size: 10px; font-weight: 500; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.04em;";
    statusText.textContent = "Live";
    statusBar.appendChild(statusDot);
    statusBar.appendChild(statusText);

    // Task name
    var taskEl = document.createElement("div");
    taskEl.id = "bp-task-name";
    taskEl.style.cssText = "padding: 8px 16px 0; font-size: 12px; color: #94a3b8; line-height: 1.4; flex-shrink: 0;";

    // Divider
    var divider = document.createElement("div");
    divider.style.cssText = "height: 1px; background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.15), transparent); margin: 12px 16px; flex-shrink: 0;";

    // Activity label
    var activityLabel = document.createElement("div");
    activityLabel.style.cssText = "padding: 0 16px 8px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;";
    activityLabel.textContent = "Activity";

    // Actions list
    var actionsContainer = document.createElement("div");
    actionsContainer.id = "bp-actions";
    actionsContainer.style.cssText = "flex: 1; overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 6px;";

    // Take control bar
    var takeControlBar = document.createElement("div");
    takeControlBar.style.cssText = [
      "padding: 12px 16px", "border-top: 1px solid rgba(56, 189, 248, 0.1)",
      "flex-shrink: 0",
    ].join(";");
    var takeControlBtn = document.createElement("button");
    takeControlBtn.textContent = "Take Control";
    takeControlBtn.className = "bp-take-control-btn";
    takeControlBtn.style.cssText = [
      "width: 100%", "padding: 8px 16px",
      "background: rgba(239, 68, 68, 0.15)", "border: 1px solid rgba(239, 68, 68, 0.4)",
      "border-radius: 8px", "color: #fca5a5", "font-size: 12px", "font-weight: 600",
      "cursor: pointer", "font-family: inherit",
    ].join(";");
    takeControlBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      takeControl();
    });
    takeControlBar.appendChild(takeControlBtn);

    // Assemble sidebar
    sidebar.appendChild(header);
    sidebar.appendChild(statusBar);
    sidebar.appendChild(taskEl);
    sidebar.appendChild(divider);
    sidebar.appendChild(activityLabel);
    sidebar.appendChild(actionsContainer);
    sidebar.appendChild(takeControlBar);

    overlay.appendChild(sidebar);

    // Block page interactions via document-level capture listeners
    // Allow events on the sidebar (our UI) and its children
    var blockedEvents = ["click", "mousedown", "mouseup", "keydown", "keyup", "keypress", "input", "focus", "touchstart", "wheel"];
    for (var ei = 0; ei < blockedEvents.length; ei++) {
      (function(eventName) {
        document.addEventListener(eventName, function(e) {
          if (e.target.closest("#browser-pilot-sidebar")) return;
          e.stopPropagation();
          e.preventDefault();
        }, true);
      })(blockedEvents[ei]);
    }

    return overlay;
  }

  // ─── Sidebar Actions ──────────────────────────────────────────────────

  function formatTime(ts) {
    try {
      var d = new Date(ts);
      return d.getHours().toString().padStart(2, "0") + ":" +
             d.getMinutes().toString().padStart(2, "0") + ":" +
             d.getSeconds().toString().padStart(2, "0");
    } catch {
      return "";
    }
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderActions(actions) {
    var container = document.getElementById("bp-actions");
    if (!container) return;

    if (actions.length === lastActionCount) return;
    lastActionCount = actions.length;

    container.innerHTML = "";
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      var div = document.createElement("div");
      div.style.cssText = [
        "display: flex", "align-items: flex-start", "gap: 8px",
        "padding: 8px 10px", "background: rgba(15, 23, 42, 0.5)",
        "border: 1px solid rgba(56, 189, 248, 0.08)", "border-radius: 8px",
        "animation: bp-action-in 0.3s ease-out",
      ].join(";");

      var iconWrap = document.createElement("div");
      iconWrap.style.cssText = [
        "width: 18px", "height: 18px", "background: rgba(56, 189, 248, 0.1)",
        "border-radius: 5px", "display: flex", "align-items: center",
        "justify-content: center", "flex-shrink: 0", "margin-top: 1px",
      ].join(";");
      iconWrap.innerHTML = getActionIcon(action.type || "default");

      var textWrap = document.createElement("div");
      textWrap.style.cssText = "flex: 1;";
      var actionText = document.createElement("div");
      actionText.style.cssText = "font-size: 11px; color: #cbd5e1; line-height: 1.3;";
      actionText.textContent = action.text;
      var actionTime = document.createElement("div");
      actionTime.style.cssText = "font-size: 9px; color: #475569; margin-top: 1px;";
      actionTime.textContent = formatTime(action.timestamp);
      textWrap.appendChild(actionText);
      textWrap.appendChild(actionTime);

      div.appendChild(iconWrap);
      div.appendChild(textWrap);
      container.appendChild(div);
    }
    container.scrollTop = container.scrollHeight;
  }

  // ─── Show / Remove ────────────────────────────────────────────────────

  function showOverlay() {
    console.log("[BrowserPilot] showOverlay called — task:", currentTaskName, "actions:", currentActions.length);
    if (overlay && document.body.contains(overlay)) {
      var taskEl = document.getElementById("bp-task-name");
      if (taskEl) taskEl.textContent = currentTaskName;
      renderActions(currentActions);
      return;
    }
    var el = createOverlay();
    var taskEl = document.getElementById("bp-task-name");
    if (taskEl) taskEl.textContent = currentTaskName;
    renderActions(currentActions);
    document.body.appendChild(el);
    console.log("[BrowserPilot] Overlay appended to body");
  }

  function removeOverlay() {
    if (!overlay && !sidebar) return; // Nothing to remove
    console.log("[BrowserPilot] removeOverlay called");
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
    sidebar = null;
    currentLockOwner = null;
    lastActionCount = 0;
  }

  // ─── Idle Badge (small indicator when not active) ──────────────────────

  function showIdleBadge() {
    if (idleBadge && document.body.contains(idleBadge)) return;
    idleBadge = document.createElement("div");
    idleBadge.id = "browser-pilot-idle-badge";
    idleBadge.style.cssText = [
      "position: fixed",
      "bottom: 16px",
      "right: 16px",
      "z-index: 2147483646",
      "background: rgba(13, 17, 23, 0.9)",
      "backdrop-filter: blur(8px)",
      "border: 1px solid rgba(56, 189, 248, 0.2)",
      "border-radius: 8px",
      "padding: 8px 12px",
      "display: flex",
      "align-items: center",
      "gap: 8px",
      "cursor: pointer",
      "font-family: Inter, -apple-system, sans-serif",
      "font-size: 11px",
      "color: #94a3b8",
      "transition: opacity 0.3s",
    ].join(";");
    idleBadge.innerHTML = '<span style="width:6px;height:6px;background:#38bdf8;border-radius:50;"></span>BrowserPilot';
    idleBadge.title = "BrowserPilot is ready. Sidebar will appear when AI starts.";
    document.body.appendChild(idleBadge);
    console.log("[BrowserPilot] Idle badge shown");
  }

  function removeIdleBadge() {
    if (idleBadge && idleBadge.parentNode) {
      idleBadge.parentNode.removeChild(idleBadge);
    }
    idleBadge = null;
  }

  function takeControl() {
    console.log("[BrowserPilot] Take Control clicked");
    removeOverlay();
    // Notify service worker to set lockOwner = "user"
    try {
      chrome.runtime.sendMessage({ type: "USER_TAKEOVER" });
    } catch (e) {
      // Ignore if extension context is invalidated
    }
  }

  // ─── Message Listener ─────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === "LOCK_STATE") {
      var active = !!msg.active;
      currentLockOwner = msg.lockOwner;
      currentTaskName = msg.taskName || currentTaskName;
      currentActions = msg.actions || currentActions;

      if (active) {
        // Remove idle badge when active
        removeIdleBadge();
        // Show or update overlay
        if (lastActiveState !== true) {
          lastActiveState = true;
          console.log("[BrowserPilot] Session active — showing overlay");
          showOverlay();
        } else {
          // Already active — just update actions
          var taskEl = document.getElementById("bp-task-name");
          if (taskEl) taskEl.textContent = currentTaskName;
          renderActions(currentActions);
        }
      } else {
        if (lastActiveState !== false) {
          lastActiveState = false;
          console.log("[BrowserPilot] Session ended — hiding overlay, showing idle badge");
          removeOverlay();
          showIdleBadge();
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
        console.log("[BrowserPilot] Initial state active — showing overlay");
        currentLockOwner = state.lockOwner;
        currentTaskName = state.taskName || "";
        currentActions = state.actions || [];
        showOverlay();
      } else {
        console.log("[BrowserPilot] Initial state idle — showing idle badge");
        showIdleBadge();
      }
    } catch (err) {
      // Server not reachable — ignore
    }
  })();
})();
