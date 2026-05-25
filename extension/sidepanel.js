(function() {
  "use strict";

  var SERVER_URL = "http://localhost:3026";
  var eventSource = null;
  var lastStateKey = null;

  var activeState = document.getElementById("active-state");
  var idleState = document.getElementById("idle-state");
  var spinner = document.getElementById("spinner");
  var lockBanner = document.getElementById("lock-banner");
  var taskName = document.getElementById("task-name");
  var actionsContainer = document.getElementById("actions");
  var footer = document.getElementById("footer");
  var debugSection = document.getElementById("debug-section");
  var debugLogs = document.getElementById("debug-logs");
  var debugToggle = document.getElementById("debug-toggle");
  var debugClear = document.getElementById("debug-clear");
  var debugVisible = false;
  var debugPollTimer = null;

  function formatTime(timestamp) {
    try {
      var d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch(e) {
      return "";
    }
  }

  function getActionIcon(type) {
    var icons = {
      navigate: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#38bdf8" stroke-width="1.5"/></svg>',
      click: '<svg viewBox="0 0 24 24" fill="none"><path d="M15 15l-2 5L9 9l11 4-5 2z" stroke="#38bdf8" stroke-width="1.5"/></svg>',
      type: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7V4h16v3M9 20h6M12 4v16" stroke="#38bdf8" stroke-width="1.5"/></svg>',
      default: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#38bdf8" stroke-width="1.5"/></svg>',
    };
    return icons[type] || icons.default;
  }

  function renderActions(actions) {
    actionsContainer.innerHTML = "";
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      var el = document.createElement("div");
      el.className = "action";
      el.innerHTML =
        '<div class="action-icon">' + getActionIcon(action.type) + '</div>' +
        '<div class="action-content">' +
        '<div class="action-text">' + escapeHtml(action.text) + '</div>' +
        '<div class="action-time">' + formatTime(action.timestamp) + '</div>' +
        '</div>';
      actionsContainer.appendChild(el);
    }
    // Scroll to bottom
    actionsContainer.scrollTop = actionsContainer.scrollHeight;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function updateUI(state) {
    var active = !!state.active;
    var lockOwner = state.lockOwner || null;

    if (active) {
      activeState.style.display = "block";
      idleState.style.display = "none";
      footer.style.display = "flex";
      spinner.style.display = "block";

      if (lockOwner === "agent") {
        lockBanner.classList.add("visible");
      } else {
        lockBanner.classList.remove("visible");
      }

      taskName.textContent = state.taskName || "";
      renderActions(state.actions || []);
    } else {
      activeState.style.display = "none";
      idleState.style.display = "flex";
      footer.style.display = "none";
      spinner.style.display = "none";
      lockBanner.classList.remove("visible");
    }
  }

  function connectSSE() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    eventSource = new EventSource(SERVER_URL + "/events");

    eventSource.addEventListener("state", function(event) {
      try {
        var state = JSON.parse(event.data);
        var stateKey = [state.lockOwner, state.active, state.taskName, (state.actions || []).length].join(":");
        if (stateKey === lastStateKey) return;
        lastStateKey = stateKey;
        updateUI(state);
      } catch (err) {
        console.error("[BrowserPilot] SSE parse error:", err);
      }
    });

    eventSource.onopen = function() {
      console.log("[BrowserPilot] SSE connected");
    };

    eventSource.onerror = function() {
      console.log("[BrowserPilot] SSE error — will auto-reconnect");
    };
  }

  // ─── Debug Logs ──────────────────────────────────────────────────────

  function fetchDebug() {
    fetch(SERVER_URL + "/debug")
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        var html = '';
        html += '<div style="color:#58a6ff; margin-bottom:4px;">SSE clients: ' + data.sseClients + ' | Session: ' + data.session.status + '</div>';
        html += '<div style="color:#58a6ff; margin-bottom:8px;">Sidebar: active=' + data.sidebar.active + ' lockOwner=' + data.session.lockOwner + '</div>';
        var logs = data.recentLogs || [];
        for (var i = logs.length - 1; i >= 0; i--) {
          var log = logs[i];
          var time = new Date(log.timestamp).toLocaleTimeString();
          html += '<div style="margin-bottom:2px;"><span style="color:#484f58;">' + time + '</span> ' + escapeHtml(log.message) + '</div>';
        }
        debugLogs.innerHTML = html;
      })
      .catch(function(err) {
        debugLogs.innerHTML = '<div style="color:#ef4444;">Error: ' + err.message + '</div>';
      });
  }

  debugToggle.addEventListener("click", function() {
    debugVisible = !debugVisible;
    if (debugVisible) {
      debugSection.style.display = "block";
      debugToggle.textContent = "Hide Debug Logs";
      fetchDebug();
      debugPollTimer = setInterval(fetchDebug, 2000);
    } else {
      debugSection.style.display = "none";
      debugToggle.textContent = "Show Debug Logs";
      if (debugPollTimer) {
        clearInterval(debugPollTimer);
        debugPollTimer = null;
      }
    }
  });

  debugClear.addEventListener("click", function() {
    debugLogs.innerHTML = '';
  });

  // ─── Initial State ────────────────────────────────────────────────────

  // Initial state: idle
  updateUI({ active: false });

  // Connect to SSE
  connectSSE();
})();