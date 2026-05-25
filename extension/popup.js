(function() {
  "use strict";

  var SERVER_URL = "http://localhost:3026";
  var statusDot = document.getElementById("status-dot");
  var statusText = document.getElementById("status-text");
  var taskDisplay = document.getElementById("task-display");
  var versionDisplay = document.getElementById("version-display");
  var openSidebarBtn = document.getElementById("open-sidebar");
  var debugToggle = document.getElementById("debug-toggle");
  var debugPanel = document.getElementById("debug-panel");
  var debugVisible = false;
  var debugPollTimer = null;

  function updateUI(data) {
    if (data.connected) {
      statusDot.className = "status-dot connected";
      statusText.textContent = "Connected";
    } else {
      statusDot.className = "status-dot disconnected";
      statusText.textContent = "Disconnected";
    }

    if (data.task) {
      taskDisplay.textContent = data.task;
      taskDisplay.className = "task-name";
    } else {
      taskDisplay.textContent = data.sidebarActive ? "Sidebar active" : "No active task";
      taskDisplay.className = data.sidebarActive ? "task-name" : "task-name no-task";
    }

    if (data.version) {
      versionDisplay.textContent = "v" + data.version;
    }
  }

  // Get status from server directly (not via service worker)
  function fetchStatus() {
    fetch(SERVER_URL + "/status")
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        updateUI({
          connected: true,
          sidebarActive: data.sidebarActive || false,
          task: data.currentTask || null,
          sessionState: data.sessionState || "idle",
          version: "1.0.0"
        });
      })
      .catch(function() {
        updateUI({ connected: false, sidebarActive: false, task: null, version: "1.0.0" });
      });
  }

  // Fetch debug logs from server
  function fetchLogs() {
    fetch(SERVER_URL + "/logs")
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        renderLogs(data.logs || []);
      })
      .catch(function(err) {
        debugPanel.innerHTML = '<div style="color:#ef4444;">Error: ' + err.message + '</div>';
      });
  }

  // Fetch full debug info
  function fetchDebug() {
    fetch(SERVER_URL + "/debug")
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        var html = '';
        html += '<div class="log-entry"><span class="log-msg" style="color:#58a6ff;">=== SERVER STATE ===</span></div>';
        html += '<div class="log-entry"><span class="log-msg">SSE clients: ' + data.sseClients + '</span></div>';
        html += '<div class="log-entry"><span class="log-msg">Session: ' + JSON.stringify(data.session) + '</span></div>';
        html += '<div class="log-entry"><span class="log-msg">Sidebar: active=' + data.sidebar.active + ' task=' + (data.sidebar.taskName || 'none') + '</span></div>';
        html += '<div class="log-entry"><span class="log-msg" style="color:#58a6ff;">=== RECENT LOGS ===</span></div>';
        html += renderLogsHtml(data.recentLogs || []);
        debugPanel.innerHTML = html;
      })
      .catch(function(err) {
        debugPanel.innerHTML = '<div style="color:#ef4444;">Error: ' + err.message + '</div>';
      });
  }

  function renderLogs(logs) {
    debugPanel.innerHTML = renderLogsHtml(logs);
  }

  function renderLogsHtml(logs) {
    var html = '';
    for (var i = logs.length - 1; i >= 0; i--) {
      var log = logs[i];
      var time = new Date(log.timestamp).toLocaleTimeString();
      html += '<div class="log-entry"><span class="log-time">' + time + '</span> <span class="log-msg">' + escapeHtml(log.message) + '</span></div>';
    }
    return html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Toggle debug panel
  debugToggle.addEventListener("click", function() {
    debugVisible = !debugVisible;
    if (debugVisible) {
      debugPanel.classList.add("visible");
      debugToggle.textContent = "Hide Debug Logs";
      fetchDebug();
      // Poll logs every 2 seconds while visible
      debugPollTimer = setInterval(fetchDebug, 2000);
    } else {
      debugPanel.classList.remove("visible");
      debugToggle.textContent = "Show Debug Logs";
      if (debugPollTimer) {
        clearInterval(debugPollTimer);
        debugPollTimer = null;
      }
    }
  });

  // Initial status fetch
  fetchStatus();

  // Open sidebar button
  openSidebarBtn.addEventListener("click", function() {
    chrome.runtime.sendMessage({ type: "OPEN_SIDEBAR" }, function(response) {
      if (response && response.success) {
        window.close();
      }
    });
  });

  // Take control button
  var takeControlBtn = document.getElementById("take-control");
  takeControlBtn.addEventListener("click", function() {
    chrome.runtime.sendMessage({ type: "USER_TAKEOVER" }, function(response) {
      if (response && response.success) {
        window.close();
      }
    });
  });
})();