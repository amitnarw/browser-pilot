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

  console.log("[BrowserPilot] Content script loaded on " + window.location.href);

  var cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = chrome.runtime.getURL("glow.css");
  document.head.appendChild(cssLink);

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
    ".bp-glow-container {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  z-index: 2147483648; pointer-events: none;",
    "  -webkit-mask-image: radial-gradient(ellipse 50vw 50vh at center, transparent 0%, black 100%);",
    "  mask-image: radial-gradient(ellipse 50vw 50vh at center, transparent 0%, black 100%);",
    "  opacity: 0.8;",
    "}",
    ".bp-sharp-container {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  z-index: 2147483649; pointer-events: none;",
    "}",
    ".bp-glow-mask {",
    "  position: absolute; top: 0; left: 0; right: 0; bottom: 0;",
    "  padding: 130px; box-sizing: border-box;",
    "  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);",
    "  -webkit-mask-composite: xor;",
    "  mask-composite: exclude;",
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
    "  background-image: conic-gradient(from 0turn, transparent 0%, #f472b600 5%, #f472b6 10%, #c084fc 18%, #818cf8 26%, #38bdf8 34%, #2dd4bf 42%, #fbbf24 46%, #fbbf2400 52%, transparent 56%);",
    "  animation: bp-spin 4s linear infinite;",
    "  transform-origin: center;",
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
    "@keyframes neon-pulse { 0% { transform: scale(1); box-shadow: 0 0 10px rgba(173,198,255,0.5); } 50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(173,198,255,0.8), 0 0 40px rgba(173,198,255,0.4); } 100% { transform: scale(1); box-shadow: 0 0 10px rgba(173,198,255,0.5); } }",
    "@keyframes mesh-flow { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }",
    ".bp-premium-wrapper { position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }",
    ".bp-premium-orb { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background-color: #131315; background-image: radial-gradient(circle at 0% 0%, rgba(75, 142, 255, 0.6) 0px, transparent 70%), radial-gradient(circle at 100% 100%, rgba(125, 1, 177, 0.6) 0px, transparent 70%), linear-gradient(135deg, rgba(0,91,193,0.4) 0%, rgba(0,122,255,0.4) 100%); background-size: 200% 200%; animation: neon-pulse 2s infinite ease-in-out, mesh-flow 4s ease-in-out infinite; border: none; }",
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
  ].join("\n");
  document.head.appendChild(styleEl);

  function createGradientAnimation(parent){
    if(gradientAnimContainer)return;
    gradientAnimContainer=document.createElement("div");
    gradientAnimContainer.id="bp-gradient-anim-container";
    
    var glow=document.createElement("div");glow.className="bp-glow-container";
    var glowMask=document.createElement("div");glowMask.className="bp-glow-mask";
    var glowSpin=document.createElement("div");glowSpin.className="bp-gradient-spin";
    glowMask.appendChild(glowSpin);
    glow.appendChild(glowMask);
    
    var sharp=document.createElement("div");sharp.className="bp-sharp-container";
    var sharpMask=document.createElement("div");sharpMask.className="bp-sharp-mask";
    var sharpSpin=document.createElement("div");sharpSpin.className="bp-gradient-spin";
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

  function resetIdleTimer(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){console.log("[BrowserPilot] Idle timeout");},IDLE_TIMEOUT_MS);}
  function clearIdleTimer(){if(idleTimer)clearTimeout(idleTimer);idleTimer=null;}

  function startStateCheck(){if(stateCheckInterval)clearInterval(stateCheckInterval);stateCheckInterval=setInterval(async function(){if(lastActiveState!==true)return;try{var r=await fetch("http://localhost:3026/sidebar/state");var s=await r.json();if(!s.active){console.log("[BrowserPilot] State check: session ended");lastActiveState=false;clearIdleTimer();removeOverlay();removeGradientAnimation();showBadge();}}catch(e){}},STATE_CHECK_INTERVAL_MS);}
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
    sb.title = "Stop BrowserPilot";
    sb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6" fill="currentColor"></rect></svg>';
    sb.addEventListener("click",function(e){e.stopPropagation();showStopDialog();});
    
    btnGroup.appendChild(ob);
    btnGroup.appendChild(sb);
    container.appendChild(btnGroup);

    overlay.appendChild(container);document.body.appendChild(overlay);
    createGradientAnimation(overlay);startStateCheck();
    
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
      var labels={navigate:"navigating",click:"clicking",type:"typing",keypress:"pressing key",fill:"filling",scroll:"scrolling",screenshot:"capturing screenshot",snapshot:"reading page",wait:"waiting",evaluate:"evaluating",tab:"switching tab","default":"working"};
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
    stopBtn.addEventListener('click', function() { dOverlay.remove(); stopBrowserPilot(); });
    
    actions.appendChild(cancelBtn);
    actions.appendChild(stopBtn);
    
    dialog.appendChild(title);
    dialog.appendChild(desc);
    dialog.appendChild(actions);
    
    dOverlay.appendChild(dialog);
    document.body.appendChild(dOverlay);
  }

  function stopBrowserPilot(){console.log("[BrowserPilot] Stop confirmed");clearIdleTimer();removeOverlay();removeGradientAnimation();showBadge();try{chrome.runtime.sendMessage({type:"STOP_BROWSER"});}catch(e){}}

  function showBadge(){if(badge&&document.body.contains(badge))return;badge=document.createElement("div");badge.className="bp-badge";badge.innerHTML='<div class="bp-badge-dot"></div><div><div class="bp-badge-title">BrowserPilot</div><div class="bp-badge-sub">Ready</div></div>';badge.addEventListener("click",function(e){e.stopPropagation();try{chrome.runtime.sendMessage({type:"OPEN_SIDEBAR"});}catch(x){}});document.body.appendChild(badge);}
  function removeBadge(){if(badge&&badge.parentNode)badge.parentNode.removeChild(badge);badge=null;}

  function takeControl(){console.log("[BrowserPilot] Take Control clicked");clearIdleTimer();removeOverlay();removeGradientAnimation();showBadge();try{chrome.runtime.sendMessage({type:"USER_TAKEOVER"});}catch(e){}}

  chrome.runtime.onMessage.addListener(function(msg){
    if(msg.type==="LOCK_STATE"){
      var active=!!msg.active;currentTaskName=msg.taskName||currentTaskName;currentActionCount=(msg.actions||[]).length;
      var actionType=msg.lastActionType||"default";
      if(active){removeBadge();if(lastActiveState!==true){lastActiveState=true;console.log("[BrowserPilot] Session active");createOverlay();}updateStatus(currentTaskName,currentActionCount,actionType);}
      else{if(lastActiveState!==false){lastActiveState=false;console.log("[BrowserPilot] Session ended");clearIdleTimer();removeOverlay();removeGradientAnimation();showBadge();}}
    }
  });

  (async function(){
    try{var r=await fetch("http://localhost:3026/sidebar/state");var s=await r.json();lastActiveState=!!s.active;
    if(s.active){currentTaskName=s.taskName||"";currentActionCount=(s.actions||[]).length;var la=s.actions&&s.actions.length>0?s.actions[s.actions.length-1]:null;lastActionType=la?la.type:"default";createOverlay();updateStatus(currentTaskName,currentActionCount,lastActionType);}else{showBadge();}}catch(e){showBadge();}
    setTimeout(async function(){if(lastActiveState)return;try{var r2=await fetch("http://localhost:3026/sidebar/state");var s2=await r2.json();if(s2.active){lastActiveState=true;currentTaskName=s2.taskName||"";currentActionCount=(s2.actions||[]).length;var la2=s2.actions&&s2.actions.length>0?s2.actions[s2.actions.length-1]:null;lastActionType=la2?la2.type:"default";removeBadge();createOverlay();updateStatus(currentTaskName,currentActionCount,lastActionType);}}catch(x){}},4000);
  })();
})();