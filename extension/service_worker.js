var SERVER_URL = "http://localhost:3026";
var VERSION = "1.0.0";
var eventSource = null;
var lastBroadcastKey = null;
var broadcastCount = 0;

function log(msg) {
  console.log("[BrowserPilot] " + msg);
}

function broadcastToTabs(state) {
  var lockOwner = state.lockOwner || null;
  var taskName = state.taskName || "";
  var actions = state.actions || [];
  var active = state.active || false;
  var lastActionType = state.lastActionType || null;
  var sessionStatus = state.sessionStatus || "idle";

  // Build a state key — only broadcast when something actually changed
  var stateKey = [lockOwner, active, taskName, actions.length, lastActionType].join(":");
  if (stateKey === lastBroadcastKey) {
    log("[broadcastToTabs] No change, skipping (key=" + stateKey + ")");
    return;
  }
  lastBroadcastKey = stateKey;
  broadcastCount++;

  log("[broadcastToTabs] #" + broadcastCount + " active=" + active + " lockOwner=" + lockOwner + " actions=" + actions.length + " lastAction=" + lastActionType);

  // Broadcast to content scripts in all tabs
  try {
    chrome.tabs.query({}, function(tabs) {
      if (chrome.runtime.lastError) {
        log("[broadcastToTabs] chrome.tabs.query error: " + chrome.runtime.lastError.message);
        return;
      }
      log("[broadcastToTabs] Found " + tabs.length + " tabs");
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].id) {
          chrome.tabs.sendMessage(tabs[i].id, {
            type: "LOCK_STATE",
            lockOwner: lockOwner,
            taskName: taskName,
            actions: actions.slice(-10),
            active: active,
            lastActionType: lastActionType,
            sessionStatus: sessionStatus,
          }, function(response) {
            if (chrome.runtime.lastError) {
              // Tab might not have content script — that's OK
            }
          });
        }
      }
    });
  } catch (err) {
    log("[broadcastToTabs] Error: " + err.message);
  }
}

function connectSSE() {
  if (eventSource) {
    log("[connectSSE] Closing existing connection");
    eventSource.close();
    eventSource = null;
  }

  // Reset dedup key so initial state on connect is always broadcast to tabs
  lastBroadcastKey = null;

  log("[connectSSE] Connecting to " + SERVER_URL + "/events...");
  eventSource = new EventSource(SERVER_URL + "/events");

  eventSource.addEventListener("state", function(event) {
    try {
      var state = JSON.parse(event.data);
      log("[SSE] Received state: active=" + state.active + " lockOwner=" + state.lockOwner + " actions=" + (state.actions || []).length);
      broadcastToTabs(state);
    } catch (err) {
      log("[SSE] Parse error: " + err.message);
    }
  });

  eventSource.onopen = function() {
    log("[SSE] Connection opened");
  };

  eventSource.onerror = function(err) {
    log("[SSE] Connection error — will auto-reconnect");
  };
}

// Periodic SSE reconnection check — handles service worker restarts,
// server restarts, and initial connection failures (server not yet running)
setInterval(function() {
  if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
    log("[SSE] Connection closed — reconnecting...");
    connectSSE();
  }
}, 3000);

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === "POPUP_GET_STATUS") {
    log("[POPUP_GET_STATUS] Received");
    if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
      log("[POPUP_GET_STATUS] SSE disconnected, reconnecting...");
      connectSSE();
    }
    fetch(SERVER_URL + "/status")
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        log("[POPUP_GET_STATUS] Sending response: " + JSON.stringify(data));
        sendResponse({
          connected: true,
          sidebarActive: data.sidebarActive || false,
          task: data.currentTask || null,
          sessionState: data.sessionState || "idle",
          version: VERSION
        });
      })
      .catch(function(err) {
        log("[POPUP_GET_STATUS] Error: " + err.message);
        sendResponse({
          connected: false,
          sidebarActive: false,
          task: null,
          sessionState: "idle",
          version: VERSION
        });
      });
    return true;
  }

  if (msg.type === "USER_TAKEOVER") {
    log("[USER_TAKEOVER] Sending /session/lock with owner=user");
    fetch(SERVER_URL + "/session/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "user", action: null }),
    })
      .then(function() { sendResponse({ success: true }); })
      .catch(function(err) { sendResponse({ success: false, error: err.message }); });
    return true;
  }

  if (msg.type === "STOP_BROWSER") {
    log("[STOP_BROWSER] Stop signal received — sending /session/stop");
    fetch(SERVER_URL + "/session/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(function() {
        log("[STOP_BROWSER] Server stopped successfully");
        sendResponse({ success: true });
      })
      .catch(function(err) {
        log("[STOP_BROWSER] Server stop failed: " + err.message);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  // OPEN_SIDEBAR — works because triggered by user gesture (click on content script button)
  if (msg.type === "OPEN_SIDEBAR") {
    log("[OPEN_SIDEBAR] Opening native side panel");
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (tabs[0] && tabs[0].windowId) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId })
          .then(function() { sendResponse({ success: true }); })
          .catch(function(err) { sendResponse({ success: false, error: err.message }); });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(function() {
  log("[onInstalled] Extension installed");
});

log("Service worker loaded — connecting SSE...");
connectSSE();
