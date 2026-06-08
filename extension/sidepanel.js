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

  function renderActions(actions) {
    actionsContainer.innerHTML = "";
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      var isLast = (i === actions.length - 1);
      
      var el = document.createElement("div");
      
      if (!isLast) {
        el.className = "flex gap-4 relative pb-6 group action-item";
        el.style.animationDelay = (Math.min(i * 0.05, 0.5)) + "s";
        el.innerHTML =
          '<div class="w-6 h-6 rounded-full bg-primary-container/20 border border-primary text-primary flex items-center justify-center shrink-0 z-10 backdrop-blur-sm shadow-[0_0_10px_rgba(173,198,255,0.3)]">' +
          '<span class="material-symbols-outlined text-[14px]" data-icon="check">check</span>' +
          '</div>' +
          '<div class="flex flex-col gap-1 pt-0.5">' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors">' + escapeHtml(action.text) + '</p>' +
          '<span class="font-mono-code text-mono-code text-outline text-[11px]">' + formatTime(action.timestamp) + '</span>' +
          '</div>';
      } else {
        el.className = "flex gap-4 relative group action-item";
        el.style.animationDelay = (Math.min(i * 0.05, 0.5)) + "s";
        el.innerHTML =
          '<div class="w-6 h-6 rounded-full bg-surface-container-highest border border-primary text-primary flex items-center justify-center shrink-0 z-10 backdrop-blur-sm relative shadow-[0_0_15px_rgba(75,142,255,0.2)]">' +
          '<div class="w-4 h-4 loading-ring absolute"></div>' +
          '<div class="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>' +
          '</div>' +
          '<div class="glass-card rounded-lg p-3 flex-1 flex flex-col gap-2 -mt-2">' +
          '<p class="font-body-sm text-body-sm text-on-surface font-medium">' + escapeHtml(action.text) + '</p>' +
          '<div class="flex gap-2">' +
          '<span class="px-2 py-0.5 rounded text-[10px] font-mono-code bg-primary-container/20 text-primary border border-primary/30">Action</span>' +
          '<span class="px-2 py-0.5 rounded text-[10px] font-mono-code bg-surface-container text-on-surface-variant border border-white/5">' + formatTime(action.timestamp) + '</span>' +
          '</div>' +
          '</div>';
      }

      actionsContainer.appendChild(el);
    }
    
    var mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = mainEl.scrollHeight;
    }
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
      activeState.classList.remove("hidden");
      activeState.classList.add("flex");
      idleState.classList.add("hidden");
      spinner.classList.remove("hidden");

      if (lockOwner === "agent") {
        lockBanner.classList.remove("hidden");
        lockBanner.classList.add("flex");
      } else {
        lockBanner.classList.add("hidden");
        lockBanner.classList.remove("flex");
      }

      taskName.textContent = state.taskName || "Processing...";
      renderActions(state.actions || []);
    } else {
      activeState.classList.add("hidden");
      activeState.classList.remove("flex");
      idleState.classList.remove("hidden");
      spinner.classList.add("hidden");
      lockBanner.classList.add("hidden");
      lockBanner.classList.remove("flex");
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
        html += '<div style="color:#adc6ff; margin-bottom:4px;">SSE clients: ' + data.sseClients + ' | Session: ' + data.session.status + '</div>';
        html += '<div style="color:#adc6ff; margin-bottom:8px;">Sidebar: active=' + data.sidebar.active + ' lockOwner=' + data.session.lockOwner + '</div>';
        var logs = data.recentLogs || [];
        for (var i = logs.length - 1; i >= 0; i--) {
          var log = logs[i];
          var time = new Date(log.timestamp).toLocaleTimeString();
          html += '<div style="margin-bottom:2px;"><span style="color:#8b90a0;">' + time + '</span> ' + escapeHtml(log.message) + '</div>';
        }
        debugLogs.innerHTML = html;
      })
      .catch(function(err) {
        debugLogs.innerHTML = '<div style="color:#ffb4ab;">Error: ' + err.message + '</div>';
      });
  }

  debugToggle.addEventListener("click", function() {
    debugVisible = !debugVisible;
    if (debugVisible) {
      debugSection.classList.remove("hidden");
      debugSection.classList.add("flex");
      debugToggle.textContent = "Hide Debug Logs";
      fetchDebug();
      debugPollTimer = setInterval(fetchDebug, 2000);
    } else {
      debugSection.classList.add("hidden");
      debugSection.classList.remove("flex");
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