(function() {
  "use strict";

  var port = globalThis.WEB_MCP_PORT || 3026;
  var SERVER_URL = "http://localhost:" + port;
  var eventSource = null;
  var lastStateKey = null;

  var activeState = document.getElementById("active-state");
  var idleState = document.getElementById("idle-state");
  var spinner = document.getElementById("spinner");
  var lockBanner = document.getElementById("lock-banner");
  var taskName = document.getElementById("current-task");
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
          '<p class="font-body-sm text-[12px] text-on-surface-variant group-hover:text-on-surface transition-colors">' + escapeHtml(action.text) + '</p>' +
          '<span class="font-mono-code text-mono-code text-outline text-[10px]">' + formatTime(action.timestamp) + '</span>' +
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
          '<p class="font-body-sm text-[12px] text-on-surface font-medium">' + escapeHtml(action.text) + '</p>' +
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
      setTimeout(function() {
        mainEl.scrollTo({ top: mainEl.scrollHeight, behavior: "smooth" });
      }, 50);
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
        console.error("[Web MCP] SSE parse error:", err);
      }
    });

    eventSource.onopen = function() {
      console.log("[Web MCP] SSE connected");
    };

    eventSource.onerror = function() {
      console.log("[Web MCP] SSE error — will auto-reconnect");
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

  var haltBtn = document.getElementById("halt-btn");
  if (haltBtn) {
    haltBtn.addEventListener("click", function() {
      showStopDialog();
    });
  }

  function showStopDialog() {
    var dOverlay = document.createElement('div');
    dOverlay.className = 'bp-dialog-overlay';
    dOverlay.addEventListener('click', function(e) {
      if(e.target === dOverlay) dOverlay.remove();
    });

    var dialog = document.createElement('div');
    dialog.className = 'bp-dialog';
    
    var title = document.createElement('h3');
    title.className = 'bp-dialog-title';
    title.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Halt AI Session?';
    
    var desc = document.createElement('p');
    desc.className = 'bp-dialog-desc';
    desc.innerText = 'This will end the current task and return control to you.';
    
    var actions = document.createElement('div');
    actions.className = 'bp-dialog-actions';
    
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'bp-dialog-btn bp-dialog-btn-cancel';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.addEventListener('click', function() { dOverlay.remove(); });
    
    var stopBtn = document.createElement('button');
    stopBtn.className = 'bp-dialog-btn bp-dialog-btn-stop';
    stopBtn.innerText = 'Halt Action';
    stopBtn.addEventListener('click', function() { 
      dOverlay.remove(); 
      fetch(SERVER_URL + "/session/stop", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ haltedByUser: true })
      }).catch(function(err) { console.error("[Web MCP] Halt error:", err); });
    });
    
    actions.appendChild(cancelBtn);
    actions.appendChild(stopBtn);
    
    dialog.appendChild(title);
    dialog.appendChild(desc);
    dialog.appendChild(actions);
    
    dOverlay.appendChild(dialog);
    document.body.appendChild(dOverlay);
  }

  // Connect to SSE
  connectSSE();
})();