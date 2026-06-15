(function() {
  "use strict";

  var overlay = null;
  var badge = null;
  var gradientAnimContainer = null;
  var lastActiveState = null;
  var currentTaskName = "";
  var currentActionCount = 0;
  var lastActionType = "default";
  var idleTimer = null;
  var IDLE_TIMEOUT_MS = 3000;
  var stateCheckInterval = null;
  var STATE_CHECK_INTERVAL_MS = 5000;

  console.log("[Web MCP] Content script loaded on " + window.location.href);

  var styleEl = document.createElement("style");
  styleEl.textContent = [
    "@keyframes bp-spin { from { transform: rotate(0turn); } to { transform: rotate(-1turn); } }",
    ".bp-overlay {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  background: rgba(0, 0, 0, 0.35); z-index: 2147483647;",
    "  display: flex; align-items: flex-end; justify-content: center;",
    "  pointer-events: auto; cursor: not-allowed;",
    "  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;",
    "}",
    "html[data-bp-ai-acting='true'] .bp-overlay, html[data-bp-ai-acting='mouse'] .bp-overlay { pointer-events: none !important; }",
    ".bp-glow-container {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  z-index: 2147483648; pointer-events: none;",
    "  opacity: 1;",
    "}",
    ".bp-sharp-container {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  z-index: 2147483649; pointer-events: none;",
    "}",
    ".bp-glow-mask {",
    "  position: absolute; top: 0; left: 0; right: 0; bottom: 0;",
    "  -webkit-mask-image: radial-gradient(ellipse at center, transparent 40%, black 75%);",
    "  mask-image: radial-gradient(ellipse at center, transparent 40%, black 75%);",
    "  overflow: hidden;",
    "}",
    ".bp-sharp-mask {",
    "  position: absolute; top: 0; left: 0; right: 0; bottom: 0;",
    "  padding: 2px; box-sizing: border-box;",
    "  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);",
    "  -webkit-mask-composite: xor;",
    "  mask-composite: exclude;",
    "  overflow: hidden;",
    "}",
    ".bp-gradient-spin {",
    "  position: absolute; top: 50%; left: 50%; width: 200vmax; height: 200vmax;",
    "  margin-top: -100vmax; margin-left: -100vmax;",
    "  animation: bp-spin 4s linear infinite;",
    "  transform-origin: center;",
    "}",
    ".bp-glow-spin {",
    "  background-image: conic-gradient(from 0turn, rgba(173,198,255,1) 0%, rgba(0,122,255,0.7) 10%, rgba(0,91,193,0.3) 25%, transparent 40%, transparent 100%);",
    "  filter: blur(60px);",
    "  opacity: 0.7;",
    "}",
    ".bp-sharp-spin {",
    "  background-image: conic-gradient(from 0turn, rgba(173,198,255,1) 0%, rgba(0,122,255,0.9) 5%, rgba(0,91,193,0.5) 15%, transparent 25%, transparent 100%);",
    "}",
    ".bp-action-bar-root, .bp-dialog-overlay {",
    "  --bp-font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;",
    "  --bp-bg-glass: rgba(31, 31, 33, 0.7);",
    "  --bp-border-glass: rgba(255, 255, 255, 0.1);",
    "  --bp-shadow-primary: 0 12px 40px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1);",
    "}",
    ".bp-action-bar-root {",
    "  position: fixed; bottom: 48px; left: 50%; transform: translateX(-50%) translateY(0);",
    "  z-index: 2147483650; display: flex; align-items: center; padding: 10px 16px 10px 12px; gap: 14px;",
    "  background: var(--bp-bg-glass); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%);",
    "  border: 1px solid var(--bp-border-glass); border-radius: 9999px; box-shadow: var(--bp-shadow-primary);",
    "  animation: bp-slide-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); user-select: none; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);",
    "  font-family: var(--bp-font-family); pointer-events: auto; cursor: default;",
    "}",
    "@keyframes bp-slide-up { from { transform: translateX(-50%) translateY(100px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }",
    "/* --- PREMIUM ORB CSS --- */",
    "@keyframes orb-blink { 0%, 96%, 98% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }",
    "@keyframes neon-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }",
    "@keyframes mesh-flow { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }",
    ".bp-premium-wrapper { position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }",
    ".bp-premium-orb { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background-color: #131315; background-image: radial-gradient(circle at 0% 0%, rgba(0, 122, 255, 0.6) 0px, transparent 70%), radial-gradient(circle at 100% 100%, rgba(173, 198, 255, 0.6) 0px, transparent 70%), linear-gradient(135deg, rgba(0, 91, 193, 0.4) 0%, rgba(0, 122, 255, 0.4) 100%); background-size: 200% 200%; animation: mesh-flow 4s ease-in-out infinite; border: none; }",
    ".bp-orb-eyes { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 3px; z-index: 2; transition: transform 0.1s ease-out; transform: translate(var(--eye-x, 0px), var(--eye-y, 0px)); }",
    ".bp-orb-eye { width: 4px; height: 4px; background: #adc6ff; border-radius: 50%; animation: orb-blink 4s infinite; box-shadow: 0 0 4px rgba(173,198,255,0.5); }",
    ".bp-orb-eyes.orb-typing { animation: orb-eyes-dart 1s infinite alternate; }",
    "@keyframes orb-eyes-dart { 0% { transform: translate(calc(var(--eye-x, 0px) - 2px), var(--eye-y, 0px)); } 100% { transform: translate(calc(var(--eye-x, 0px) + 2px), var(--eye-y, 0px)); } }",
    ".bp-status-container { max-width: 250px; overflow: hidden; display: flex; align-items: center; }",
    ".bp-status-text { font-size: 14px; font-weight: 500; color: #e4e2e4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; transition: opacity 0.2s ease; font-family: 'Inter', sans-serif; }",
    ".bp-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 1px; }",
    ".bp-button-group { display: flex; gap: 4px; }",
    ".bp-action-btn { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; color: #c1c6d7; background: transparent; border: none; padding: 0; }",
    ".bp-action-btn:hover { background: rgba(255, 255, 255, 0.05); color: #e4e2e4; }",
    ".bp-action-btn:active { background: rgba(255, 255, 255, 0.1); }",
    ".bp-action-btn svg { width: 16px; height: 16px; stroke-width: 2; }",
    ".bp-btn-stop:hover { color: #ffb4ab; background: rgba(147, 0, 10, 0.2); }",
    ".bp-dialog-overlay {",
    "  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483651;",
    "  display: flex; align-items: center; justify-content: center; pointer-events: auto;",
    "  background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);",
    "  animation: bp-fade-in-fast 0.2s ease-out; font-family: 'Inter', sans-serif;",
    "}",
    "@keyframes bp-fade-in-fast { from { opacity: 0; } to { opacity: 1; } }",
    ".bp-dialog {",
    "  background: #131315; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);",
    "  padding: 24px; width: 300px; display: flex; flex-direction: column; gap: 12px;",
    "  transform: scale(0.95); animation: bp-pop-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;",
    "}",
    "@keyframes bp-pop-in { to { transform: scale(1); } }",
    ".bp-dialog-title { font-size: 16px; font-weight: 600; color: #adc6ff; margin: 0; display: flex; align-items: center; gap: 8px; }",
    ".bp-dialog-desc { font-size: 14px; color: #c1c6d7; margin: 0; line-height: 1.5; }",
    ".bp-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }",
    ".bp-dialog-btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }",
    ".bp-dialog-btn-cancel { background: rgba(255,255,255,0.1); color: #c1c6d7; }",
    ".bp-dialog-btn-cancel:hover { background: rgba(255,255,255,0.15); color: #e4e2e4; }",
    ".bp-dialog-btn-stop { background: rgba(147,0,10,0.3); color: #ffb4ab; }",
    ".bp-dialog-btn-stop:hover { background: rgba(147,0,10,0.4); }",
    ".bp-badge {",
    "  position: fixed; bottom: 16px; right: 16px; z-index: 2147483646;",
    "  background: rgba(255,255,255,0.1); border: none; border-radius: 8px;",
    "  padding: 8px 12px; display: flex; align-items: center; gap: 8px;",
    "  cursor: pointer; font-family: 'Inter', sans-serif;",
    "  font-size: 12px; color: #c1c6d7; box-shadow: 0 4px 12px rgba(0,0,0,0.3);",
    "}",
    ".bp-badge:hover { background: rgba(255,255,255,0.15); }",
    ".bp-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #adc6ff; box-shadow: 0 0 8px rgba(173,198,255,0.4); }",
    ".bp-badge-title { font-weight: 600; font-size: 11px; color: #e4e2e4; }",
    ".bp-badge-sub { font-size: 10px; color: #8b90a0; }",
    ".bp-chat-bubble {",
    "  position: absolute; bottom: 130%; left: 23px; transform: translateX(-50%) translateY(10px);",
    "  background: #2a2a2c;",
    "  padding: 8px 12px; border-radius: 8px;",
    "  color: #e4e2e4; font-size: 11px; font-weight: 500; font-family: var(--bp-font-family);",
    "  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05);",
    "  opacity: 0; pointer-events: auto;",
    "  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); white-space: nowrap;",
    "  display: flex; gap: 12px; align-items: center;",
    "}",
    ".bp-chat-bubble.visible { opacity: 1; transform: translateX(-50%) translateY(0); }",
    ".bp-chat-bubble::after {",
    "  content: ''; position: absolute; bottom: -4px; left: 50%; width: 10px; height: 10px;",
    "  margin-left: -5px; background: #2a2a2c;",
    "  box-shadow: 1px 1px 0 rgba(255,255,255,0.05);",
    "  transform: rotate(45deg);",
    "}",
    ".bp-bubble-stop-btn { background: rgba(147,0,10,0.3); color: #ffb4ab; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600; font-family: var(--bp-font-family); transition: background 0.2s; }",
    ".bp-bubble-stop-btn:hover { background: rgba(147,0,10,0.5); }",
  ].join("\n");
  document.head.appendChild(styleEl);

  function createGradientAnimation(parent){
    if(gradientAnimContainer)return;
    gradientAnimContainer=document.createElement("div");
    gradientAnimContainer.id="bp-gradient-anim-container";
    
    var glow=document.createElement("div");glow.className="bp-glow-container";
    var glowMask=document.createElement("div");glowMask.className="bp-glow-mask";
    var glowSpin=document.createElement("div");glowSpin.className="bp-gradient-spin bp-glow-spin";
    glowMask.appendChild(glowSpin);
    glow.appendChild(glowMask);
    
    var sharp=document.createElement("div");sharp.className="bp-sharp-container";
    var sharpMask=document.createElement("div");sharpMask.className="bp-sharp-mask";
    var sharpSpin=document.createElement("div");sharpSpin.className="bp-gradient-spin bp-sharp-spin";
    sharpMask.appendChild(sharpSpin);
    sharp.appendChild(sharpMask);
    
    gradientAnimContainer.appendChild(glow);
    gradientAnimContainer.appendChild(sharp);
    if(parent){
      parent.insertBefore(gradientAnimContainer, parent.firstChild);
    } else {
      document.body.appendChild(gradientAnimContainer);
    }
  }

  function removeGradientAnimation(){
    if(gradientAnimContainer){
      if(gradientAnimContainer.parentNode)gradientAnimContainer.parentNode.removeChild(gradientAnimContainer);
      gradientAnimContainer=null;
    }
  }

  // --- EVENT INTERCEPTION ---
  // The .bp-overlay natively blocks mouse events with pointer-events: auto.
  // However, during AI action execution, we temporarily set pointer-events: none 
  // via CSS (data-bp-ai-acting='true') so the CDP click hits the real element.
  // We use these JS listeners as a secondary defense, especially for keyboard events.
  var blockedEvents = ["click", "mousedown", "mouseup", "dblclick", "keydown", "keypress", "keyup"];
  blockedEvents.forEach(function(evName) {
    document.addEventListener(evName, function(e) {
      var acting = document.documentElement.getAttribute("data-bp-ai-acting");
      if (acting === "true") return; // fallback
      if (acting === "mouse" && ["click", "mousedown", "mouseup", "dblclick"].includes(e.type)) return;
      if (acting === "keyboard" && ["keydown", "keypress", "keyup"].includes(e.type)) return;
      
      if (lastActiveState === true) {    // Block if AI session is active
        // Only block if it's NOT a click inside our own BP UI or on the overlay itself
        var isOwnUI = e.target.closest && e.target.closest(".bp-action-bar-root, .bp-dialog-overlay, .bp-badge, .bp-overlay");
        if (!isOwnUI) {
          e.stopPropagation();
          e.preventDefault();
        }
      }
    }, true); // true = capture phase
  });

  function resetIdleTimer(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){console.log("[Web MCP] Idle timeout");},IDLE_TIMEOUT_MS);}
  function clearIdleTimer(){if(idleTimer)clearTimeout(idleTimer);idleTimer=null;}

  function startStateCheck(){if(stateCheckInterval)clearInterval(stateCheckInterval);stateCheckInterval=setInterval(async function(){if(lastActiveState!==true)return;try{var r=await fetch("http://localhost:3026/sidebar/state");var s=await r.json();if(!s.active){console.log("[Web MCP] State check: session ended");lastActiveState=false;clearIdleTimer();removeOverlay();removeGradientAnimation();showBadge();}}catch(e){}},STATE_CHECK_INTERVAL_MS);}
  function stopStateCheck(){if(stateCheckInterval){clearInterval(stateCheckInterval);stateCheckInterval=null;}}

  function createOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement("div");overlay.className="bp-overlay";
    
    var container = document.createElement("div");
    container.className = "bp-action-bar-root";

    var wrapper = document.createElement("div");
    wrapper.className = "bp-premium-wrapper";
    var orb = document.createElement("div"); orb.className = "bp-premium-orb";
    var eyes = document.createElement("div"); eyes.className = "bp-orb-eyes"; eyes.id = "bp-orb-eyes";
    var eye1 = document.createElement("div"); eye1.className = "bp-orb-eye";
    var eye2 = document.createElement("div"); eye2.className = "bp-orb-eye";
    eyes.appendChild(eye1); eyes.appendChild(eye2);
    orb.appendChild(eyes);
    wrapper.appendChild(orb);
    container.appendChild(wrapper);

    var statusContainer = document.createElement("div");
    statusContainer.className = "bp-status-container";
    var status = document.createElement("span");
    status.className = "bp-status-text";
    status.id = "bp-bar-status";
    status.textContent = "working...";
    statusContainer.appendChild(status);
    container.appendChild(statusContainer);

    var divi = document.createElement("div");
    divi.className = "bp-divider";
    container.appendChild(divi);

    var btnGroup = document.createElement("div");
    btnGroup.className = "bp-button-group";

    var ob = document.createElement("button");
    ob.className = "bp-action-btn";
    ob.title = "Open Sidebar";
    ob.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    ob.addEventListener("click",function(e){e.stopPropagation();try{chrome.runtime.sendMessage({type:"OPEN_SIDEBAR"});}catch(x){}});
    
    var sb = document.createElement("button");
    sb.className = "bp-action-btn bp-btn-stop";
    sb.title = "Stop Web MCP";
    sb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6" fill="currentColor"></rect></svg>';
    sb.addEventListener("click",function(e){e.stopPropagation();showStopDialog();});
    
    btnGroup.appendChild(ob);
    btnGroup.appendChild(sb);
    container.appendChild(btnGroup);

    var bubble = document.createElement("div");
    bubble.className = "bp-chat-bubble";
    bubble.id = "bp-chat-bubble";
    
    var bubbleText = document.createElement("span");
    bubbleText.className = "bp-bubble-text";
    bubbleText.id = "bp-bubble-text";
    bubbleText.innerText = "AI is working...";
    
    var bubbleStopBtn = document.createElement("button");
    bubbleStopBtn.className = "bp-bubble-stop-btn";
    bubbleStopBtn.id = "bp-bubble-stop-btn";
    bubbleStopBtn.innerText = "Halt";
    bubbleStopBtn.style.display = "none";
    bubbleStopBtn.addEventListener("click", function(e) { e.stopPropagation(); showStopDialog(); });

    bubble.appendChild(bubbleText);
    bubble.appendChild(bubbleStopBtn);
    container.appendChild(bubble);

    overlay.appendChild(container);document.body.appendChild(overlay);
    
    createGradientAnimation(overlay);startStateCheck();
    
    overlay.addEventListener("click", function(e) {
      if(e.target === overlay) {
        if (bubble && bubbleText) {
          bubbleText.innerText = "AI is working. Click 'Halt' to regain control.";
          var stopBtn = document.getElementById("bp-bubble-stop-btn");
          if(stopBtn) stopBtn.style.display = "inline-block";
          bubble.classList.add("visible");
          if(bubble._hideTimer) clearTimeout(bubble._hideTimer);
          bubble._hideTimer = setTimeout(function(){ bubble.classList.remove("visible"); }, 3000);
        }
      }
    });
    
    window.addEventListener("mousemove", trackEyes);
    
    return overlay;
  }

  function trackEyes(e) {
    var eyes = document.getElementById("bp-orb-eyes");
    if(!eyes) return;
    var rect = eyes.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = e.clientX - cx;
    var dy = e.clientY - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var maxDist = 3;
    if(dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
    eyes.style.setProperty('--eye-x', dx + 'px');
    eyes.style.setProperty('--eye-y', dy + 'px');
  }

  function updateStatus(taskName,actionCount,actionType){
    var se=document.getElementById("bp-bar-status");
    if(se){
      var labels={navigate:"navigating",click:"clicking",type:"typing",keypress:"pressing key",fill:"filling",scroll:"scrolling",screenshot:"capturing screenshot",snapshot:"reading page",wait:"waiting",evaluate:"evaluating",tab:"switching tab",hover:"hovering",drag:"dragging","default":"working"};
      se.style.opacity = '0';
      setTimeout(function() {
        se.textContent=(labels[actionType]||"working")+"...";
        se.style.opacity = '1';
      }, 200);
    }
    var eyes = document.getElementById("bp-orb-eyes");
    if(eyes){
      eyes.className = "bp-orb-eyes";
      if(actionType === "type" || actionType === "keypress") eyes.classList.add("orb-typing");
      else if(actionType === "navigate" || actionType === "evaluate") eyes.classList.add("orb-searching");
    }
    resetIdleTimer();
  }

  var lastActionText = "";
  function handleNewAction(action) {
    if(!action || action.text === lastActionText) return;
    lastActionText = action.text;
    
    var bubble = document.getElementById("bp-chat-bubble");
    var bubbleText = document.getElementById("bp-bubble-text");
    var bubbleStopBtn = document.getElementById("bp-bubble-stop-btn");
    
    if(bubble && bubbleText) {
      bubbleText.innerText = action.text;
      if(bubbleStopBtn) bubbleStopBtn.style.display = "none";
      bubble.classList.add("visible");
      
      if(bubble._hideTimer) clearTimeout(bubble._hideTimer);
      bubble._hideTimer = setTimeout(function() {
        bubble.classList.remove("visible");
      }, 5000);
    }
  }

  function removeOverlay(){if(!overlay)return;stopStateCheck();window.removeEventListener("mousemove", trackEyes);if(overlay.parentNode)overlay.parentNode.removeChild(overlay);overlay=null;}

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
    stopBtn.addEventListener('click', function() { dOverlay.remove(); stopWebMCP(); });
    
    actions.appendChild(cancelBtn);
    actions.appendChild(stopBtn);
    
    dialog.appendChild(title);
    dialog.appendChild(desc);
    dialog.appendChild(actions);
    
    dOverlay.appendChild(dialog);
    document.body.appendChild(dOverlay);
  }

  function stopWebMCP(){console.log("[Web MCP] Stop confirmed");clearIdleTimer();removeOverlay();removeGradientAnimation();try{chrome.runtime.sendMessage({type:"STOP_BROWSER"});}catch(e){}}

  function showBadge(){}
  function removeBadge(){}

  function takeControl(){console.log("[Web MCP] Take Control clicked");clearIdleTimer();removeOverlay();removeGradientAnimation();try{chrome.runtime.sendMessage({type:"USER_TAKEOVER"});}catch(e){}}

  chrome.runtime.onMessage.addListener(function(msg){
    if(msg.type==="LOCK_STATE"){
      var active=!!msg.active;currentTaskName=msg.taskName||currentTaskName;currentActionCount=(msg.actions||[]).length;
      var actionType=msg.lastActionType||"default";
      var lastAction = (msg.actions && msg.actions.length > 0) ? msg.actions[msg.actions.length - 1] : null;
      if(active){removeBadge();if(lastActiveState!==true){lastActiveState=true;console.log("[Web MCP] Session active");createOverlay();}updateStatus(currentTaskName,currentActionCount,actionType);handleNewAction(lastAction);}
      else{if(lastActiveState!==false){lastActiveState=false;console.log("[Web MCP] Session ended");clearIdleTimer();removeOverlay();removeGradientAnimation();showBadge();}}
    }
  });

  (async function(){
    try{var r=await fetch("http://localhost:3026/sidebar/state");var s=await r.json();lastActiveState=!!s.active;
    if(s.active){currentTaskName=s.taskName||"";currentActionCount=(s.actions||[]).length;var la=s.actions&&s.actions.length>0?s.actions[s.actions.length-1]:null;lastActionType=la?la.type:"default";createOverlay();updateStatus(currentTaskName,currentActionCount,lastActionType);handleNewAction(la);}else{showBadge();}}catch(e){showBadge();}
    setTimeout(async function(){if(lastActiveState)return;try{var r2=await fetch("http://localhost:3026/sidebar/state");var s2=await r2.json();if(s2.active){lastActiveState=true;currentTaskName=s2.taskName||"";currentActionCount=(s2.actions||[]).length;var la2=s2.actions&&s2.actions.length>0?s2.actions[s2.actions.length-1]:null;lastActionType=la2?la2.type:"default";removeBadge();createOverlay();updateStatus(currentTaskName,currentActionCount,lastActionType);handleNewAction(la2);}}catch(x){}},4000);
  })();
})();