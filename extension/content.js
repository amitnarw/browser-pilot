(function() {
  "use strict";

  var overlay = null;
  var badge = null;
  var prismaticContainer = null;
  var prismaticGl = null;
  var prismaticProgram = null;
  var prismaticAnimId = null;
  var prismaticStartTime = 0;
  var prismaticGradTex = null;
  var prismaticVao = null;
  var prismaticUniforms = {};
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
    "@keyframes bp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }",
    ".bp-overlay {",
    "  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;",
    "  background: rgba(0, 0, 0, 0.35); z-index: 2147483647;",
    "  display: flex; align-items: flex-end; justify-content: center;",
    "  pointer-events: auto; cursor: not-allowed;",
    "  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;",
    "}",
    ".bp-bar {",
    "  position: fixed; left: 50%; transform: translateX(-50%); bottom: 20px; z-index: 2147483647;",
    "  background: rgba(23, 22, 21, 0.92); backdrop-filter: blur(12px);",
    "  border: 1px solid rgba(78, 153, 163, 0.18); border-radius: 10px;",
    "  padding: 8px 14px; display: flex; align-items: center; gap: 8px;",
    "  font-family: Inter, -apple-system, sans-serif; font-size: 12px; color: #d6d5d4;",
    "  box-shadow: 0 4px 24px rgba(0,0,0,0.5); pointer-events: auto; cursor: default;",
    "}",
    ".bp-bar-status { font-size: 12px; color: #4e99a3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }",
    ".bp-badge {",
    "  position: fixed; bottom: 16px; right: 16px; z-index: 2147483646;",
    "  background: rgba(23, 22, 21, 0.92); backdrop-filter: blur(12px);",
    "  border: 1px solid rgba(78, 153, 163, 0.2); border-radius: 10px;",
    "  padding: 10px 14px; display: flex; align-items: center; gap: 10px;",
    "  cursor: pointer; font-family: Inter, -apple-system, sans-serif;",
    "  font-size: 12px; color: #d6d5d4a6; box-shadow: 0 2px 12px rgba(0,0,0,0.4);",
    "}",
    ".bp-badge:hover { border-color: rgba(78, 153, 163, 0.4); }",
    ".bp-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #5a5856; }",
    ".bp-badge-title { font-weight: 600; font-size: 11px; color: #d6d5d4; }",
    ".bp-badge-sub { font-size: 10px; color: #d6d5d480; }",
  ].join("\n");
  document.head.appendChild(styleEl);

  var ACTION_COLORS = {
    navigate:   ["#4e99a3", "#64a6af", "#3d7a82"],
    click:      ["#539e55", "#6aaf69", "#3d7a3e"],
    type:       ["#539e55", "#6aaf69", "#3d7a3e"],
    keypress:   ["#539e55", "#6aaf69", "#3d7a3e"],
    fill:       ["#539e55", "#6aaf69", "#3d7a3e"],
    scroll:     ["#bc811e", "#ce9b36", "#8a5e14"],
    screenshot: ["#a16bcd", "#b282d7", "#7a4fa3"],
    snapshot:   ["#a16bcd", "#b282d7", "#7a4fa3"],
    wait:       ["#bc811e", "#ce9b36", "#8a5e14"],
    evaluate:   ["#c95d8b", "#d77a9c", "#a14270"],
    tab:        ["#4e99a3", "#64a6af", "#3d7a82"],
    "default":  ["#4e99a3", "#64a6af", "#3d7a82"]
  };
  var IDLE_COLORS = ["#5a5856", "#6d6b69", "#4a4846"];

  var VERT = '#version 300 es\nin vec2 position;\nin vec2 uv;\nout vec2 vUv;\nvoid main(){vUv=uv;gl_Position=vec4(position,0,1);}';

  var FRAG = [
    '#version 300 es',
    'precision highp float;precision highp int;',
    'out vec4 fragColor;',
    'uniform vec2 uResolution;uniform float uTime;uniform float uIntensity;uniform float uSpeed;',
    'uniform int uAnimType;uniform vec2 uMouse;uniform int uColorCount;uniform float uDistort;',
    'uniform vec2 uOffset;uniform sampler2D uGradient;uniform float uNoiseAmount;uniform int uRayCount;',
    'float hash21(vec2 p){p=floor(p);return fract(52.9829189*fract(dot(p,vec2(.065,.005))));}',
    'mat2 rot30(){return mat2(.8,-.5,.5,.8);}',
    'float layeredNoise(vec2 fp){vec2 p=mod(fp+vec2(uTime*30.,-uTime*21.),1024.);vec2 q=rot30()*p;float n=0.;',
    'n+=.40*hash21(q);n+=.25*hash21(q*2.+17.);n+=.20*hash21(q*4.+47.);n+=.10*hash21(q*8.+113.);n+=.05*hash21(q*16.+191.);return n;}',
    'vec3 rayDir(vec2 f,vec2 r,vec2 o,float d){float fc=r.y*max(d,1e-3);return normalize(vec3(2.*(f-o)-r,fc));}',
    'float edgeFade(vec2 f,vec2 r,vec2 o){vec2 tC=f-.5*r-o;float x=clamp(length(tC)/(.5*min(r.x,r.y)),0.,1.);',
    'return smoothstep(0.,0.9,x);}',
    'mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}',
    'mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0,s,0,1,0,-s,0,c);}',
    'mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0,s,c,0,0,0,1);}',
    'vec3 sampleGradient(float t){return texture(uGradient,vec2(clamp(t,0.,1.),.5)).rgb;}',
    'vec2 rot2(vec2 v,float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c)*v;}',
    'float bendAngle(vec3 q,float t){return .8*sin(q.x*.55+t*.6)+.7*sin(q.y*.5-t*.5)+.6*sin(q.z*.6+t*.7);}',
    'void main(){',
    'vec2 frag=gl_FragCoord.xy;float t=uTime*uSpeed;float jA=.1*clamp(uNoiseAmount,0.,1.);',
    'vec3 dir=rayDir(frag,uResolution,uOffset,1.);float mT=0.;vec3 col=vec3(0.);float n=layeredNoise(frag);',
    'vec4 c=cos(t*.2+vec4(0.,33.,11.,0.));mat2 M2=mat2(c.x,c.y,c.z,c.w);float amp=clamp(uDistort,0.,50.)*.15;',
    'mat3 r3=mat3(1.);if(uAnimType==1){vec3 ag=vec3(t*.31,t*.21,t*.17);r3=rotZ(ag.z)*rotY(ag.y)*rotX(ag.x);}',
    'mat3 hM=mat3(1.);if(uAnimType==2){vec2 m=uMouse*2.-1.;vec3 ag=vec3(m.y*.6,m.x*.6,0.);hM=rotY(ag.y)*rotX(ag.x);}',
    'for(int i=0;i<44;++i){vec3 P=mT*dir;P.z-=2.;float rad=length(P);vec3 Pl=P*(10./max(rad,1e-6));',
    'if(uAnimType==0){Pl.xz*=M2;}else if(uAnimType==1){Pl=r3*Pl;}else{Pl=hM*Pl;}',
    'float sL=min(rad-.3,n*jA)+.1;float gr=smoothstep(.35,3.,mT);',
    'float a1=amp*gr*bendAngle(Pl*.6,t);float a2=.5*amp*gr*bendAngle(Pl.zyx*.5+3.1,t*.9);',
    'vec3 Pb=Pl;Pb.xz=rot2(Pb.xz,a1);Pb.xy=rot2(Pb.xy,a2);',
    'float rP=smoothstep(.5,.7,sin(Pb.x+cos(Pb.y)*cos(Pb.z))*sin(Pb.z+sin(Pb.y)*cos(Pb.x+t)));',
    'if(uRayCount>0){float ang=atan(Pb.y,Pb.x);float comb=.5+.5*cos(float(uRayCount)*ang);comb=pow(comb,3.);rP*=smoothstep(.15,.95,comb);}',
    'vec3 sD=1.+vec3(cos(mT*3.),cos(mT*3.+1.),cos(mT*3.+2.));',
    'float saw=fract(mT*.25);float tR=saw*saw*(3.-2.*saw);vec3 uG=2.*sampleGradient(tR);',
    'vec3 spec=(uColorCount>0)?uG:sD;vec3 base=(.05/(.4+sL))*smoothstep(5.,0.,rad)*spec;',
    'col+=base*rP;mT+=sL;}',
    'col*=uIntensity;float a=edgeFade(frag,uResolution,uOffset);',
    'fragColor=vec4(clamp(col,0.,1.),a);}'
  ].join('\n');

  function hexToRgb01(hex){var h=hex.trim();if(h[0]==="#")h=h.slice(1);if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var v=parseInt(h,16);if(isNaN(v))return[1,1,1];return[((v>>16)&255)/255,((v>>8)&255)/255,(v&255)/255];}

  function compileShader(gl,type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error("[BrowserPilot] Shader error:",gl.getShaderInfoLog(s));gl.deleteShader(s);return null;}return s;}

  function createGradTex(gl,colors){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);var n=colors.length;var d=new Uint8Array(n*4);for(var i=0;i<n;i++){var rgb=hexToRgb01(colors[i]);d[i*4]=Math.round(rgb[0]*255);d[i*4+1]=Math.round(rgb[1]*255);d[i*4+2]=Math.round(rgb[2]*255);d[i*4+3]=255;}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,1,0,gl.RGBA,gl.UNSIGNED_BYTE,d);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}

  function updateGradTex(gl,tex,colors){gl.bindTexture(gl.TEXTURE_2D,tex);var n=colors.length;var d=new Uint8Array(n*4);for(var i=0;i<n;i++){var rgb=hexToRgb01(colors[i]);d[i*4]=Math.round(rgb[0]*255);d[i*4+1]=Math.round(rgb[1]*255);d[i*4+2]=Math.round(rgb[2]*255);d[i*4+3]=255;}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,1,0,gl.RGBA,gl.UNSIGNED_BYTE,d);}

  function createPrismaticBurst(){
    if(prismaticContainer)return;
    prismaticContainer=document.createElement("div");prismaticContainer.className="bp-prismatic-burst";
    var canvas=document.createElement("canvas");prismaticContainer.appendChild(canvas);document.body.appendChild(prismaticContainer);
    var gl=canvas.getContext("webgl2",{alpha:true,antialias:false,premultipliedAlpha:false});
    if(!gl){console.error("[BrowserPilot] WebGL2 not available");prismaticContainer.style.background="radial-gradient(ellipse at center, transparent 10%, rgba(78,153,163,0.3) 50%, rgba(78,153,163,0.6) 100%)";return;}
    prismaticGl=gl;
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    var vs=compileShader(gl,gl.VERTEX_SHADER,VERT);var fs=compileShader(gl,gl.FRAGMENT_SHADER,FRAG);
    if(!vs||!fs){console.error("[BrowserPilot] Shader compile failed");prismaticContainer.style.background="radial-gradient(ellipse at center, transparent 10%, rgba(78,153,163,0.3) 50%, rgba(78,153,163,0.6) 100%)";return;}
    var prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){console.error("[BrowserPilot] Link error:",gl.getProgramInfoLog(prog));return;}
    gl.useProgram(prog);prismaticProgram=prog;gl.deleteShader(vs);gl.deleteShader(fs);
    var vao=gl.createVertexArray();gl.bindVertexArray(vao);
    var pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var pl=gl.getAttribLocation(prog,"position");gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
    var ub=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,ub);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,2,0,0,2]),gl.STATIC_DRAW);
    var ul=gl.getAttribLocation(prog,"uv");gl.enableVertexAttribArray(ul);gl.vertexAttribPointer(ul,2,gl.FLOAT,false,0,0);
    gl.bindVertexArray(null);prismaticVao=vao;
    prismaticUniforms={uResolution:gl.getUniformLocation(prog,"uResolution"),uTime:gl.getUniformLocation(prog,"uTime"),uIntensity:gl.getUniformLocation(prog,"uIntensity"),uSpeed:gl.getUniformLocation(prog,"uSpeed"),uAnimType:gl.getUniformLocation(prog,"uAnimType"),uMouse:gl.getUniformLocation(prog,"uMouse"),uColorCount:gl.getUniformLocation(prog,"uColorCount"),uDistort:gl.getUniformLocation(prog,"uDistort"),uOffset:gl.getUniformLocation(prog,"uOffset"),uGradient:gl.getUniformLocation(prog,"uGradient"),uNoiseAmount:gl.getUniformLocation(prog,"uNoiseAmount"),uRayCount:gl.getUniformLocation(prog,"uRayCount")};
    var colors=ACTION_COLORS[lastActionType]||ACTION_COLORS["default"];prismaticGradTex=createGradTex(gl,colors);
    gl.uniform1f(prismaticUniforms.uIntensity,8.);gl.uniform1f(prismaticUniforms.uSpeed,.5);gl.uniform1i(prismaticUniforms.uAnimType,0);
    gl.uniform2f(prismaticUniforms.uMouse,.5,.5);gl.uniform1f(prismaticUniforms.uDistort,0.);gl.uniform2f(prismaticUniforms.uOffset,0.,0.);
    gl.uniform1f(prismaticUniforms.uNoiseAmount,.8);gl.uniform1i(prismaticUniforms.uRayCount,0);gl.uniform1i(prismaticUniforms.uGradient,0);
    gl.uniform1i(prismaticUniforms.uColorCount,colors.length);
    function resize(){var w=prismaticContainer.clientWidth||1,h=prismaticContainer.clientHeight||1,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width="100%";canvas.style.height="100%";gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(prismaticUniforms.uResolution,canvas.width,canvas.height);}
    var ro=null;if(typeof ResizeObserver!=="undefined"){ro=new ResizeObserver(resize);ro.observe(prismaticContainer);}else{window.addEventListener("resize",resize);}
    resize();var accumTime=0;var last=performance.now();
    function draw(now){var dt=Math.max(0,now-last)*.001;last=now;accumTime+=dt;gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(prismaticUniforms.uTime,accumTime);gl.bindVertexArray(prismaticVao);gl.drawArrays(gl.TRIANGLES,0,3);    prismaticAnimId=requestAnimationFrame(draw);console.log("[BrowserPilot] Prismatic Burst animation started");}
    prismaticAnimId=requestAnimationFrame(draw);
    prismaticContainer._cleanup=function(){if(ro)ro.disconnect();else window.removeEventListener("resize",resize);};
  }

  function updatePrismaticColors(actionType){var type=actionType||lastActionType||"default";lastActionType=type;var colors=(type==="wait")?IDLE_COLORS:(ACTION_COLORS[type]||ACTION_COLORS["default"]);if(prismaticGl&&prismaticGradTex){updateGradTex(prismaticGl,prismaticGradTex,colors);prismaticGl.uniform1i(prismaticUniforms.uColorCount,colors.length);}}

  function removePrismaticBurst(){
    if(prismaticAnimId){cancelAnimationFrame(prismaticAnimId);prismaticAnimId=null;}
    if(prismaticContainer){if(prismaticContainer._cleanup)prismaticContainer._cleanup();if(prismaticContainer.parentNode)prismaticContainer.parentNode.removeChild(prismaticContainer);}
    if(prismaticGl){if(prismaticGradTex)prismaticGl.deleteTexture(prismaticGradTex);if(prismaticVao)prismaticGl.deleteVertexArray(prismaticVao);if(prismaticProgram)prismaticGl.deleteProgram(prismaticProgram);}
    prismaticContainer=null;prismaticGl=null;prismaticProgram=null;prismaticGradTex=null;prismaticVao=null;prismaticUniforms={};
  }

  function resetIdleTimer(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){console.log("[BrowserPilot] Idle timeout");updatePrismaticColors("idle");},IDLE_TIMEOUT_MS);}
  function clearIdleTimer(){if(idleTimer)clearTimeout(idleTimer);idleTimer=null;}

  function startStateCheck(){if(stateCheckInterval)clearInterval(stateCheckInterval);stateCheckInterval=setInterval(async function(){if(lastActiveState!==true)return;try{var r=await fetch("http://localhost:3026/sidebar/state");var s=await r.json();if(!s.active){console.log("[BrowserPilot] State check: session ended");lastActiveState=false;clearIdleTimer();removeOverlay();removePrismaticBurst();showBadge();}}catch(e){}},STATE_CHECK_INTERVAL_MS);}
  function stopStateCheck(){if(stateCheckInterval){clearInterval(stateCheckInterval);stateCheckInterval=null;}}

  function createOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement("div");overlay.className="bp-overlay";
    var bar=document.createElement("div");bar.className="bp-bar";bar.id="bp-status-bar";
    var status=document.createElement("div");status.className="bp-bar-status";status.id="bp-bar-status";status.textContent="waiting...";
    var td=document.createElement("div");td.className="bp-typing-dots";td.id="bp-typing-dots";td.innerHTML="<span></span><span></span><span></span>";td.style.display="none";
    var ob=document.createElement("button");ob.className="bp-bar-btn";ob.title="Open sidebar";
    ob.innerHTML='<svg viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke="#4e99a3" stroke-width="1.2"/><line x1="10" y1="2" x2="10" y2="14" stroke="#4e99a3" stroke-width="1.2"/></svg>';
    ob.addEventListener("click",function(e){e.stopPropagation();try{chrome.runtime.sendMessage({type:"OPEN_SIDEBAR"});}catch(x){}});
    var sb=document.createElement("button");sb.className="bp-stop-btn";sb.title="Stop BrowserPilot";
    sb.innerHTML='<svg viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="#4e99a3" opacity="0.8"/></svg>';
    sb.addEventListener("click",function(e){e.stopPropagation();stopBrowserPilot();});
    bar.appendChild(status);bar.appendChild(td);bar.appendChild(ob);bar.appendChild(sb);
    overlay.appendChild(bar);document.body.appendChild(overlay);
    createPrismaticBurst();startStateCheck();return overlay;
  }

  function updateStatus(taskName,actionCount,actionType){
    var se=document.getElementById("bp-bar-status");var td=document.getElementById("bp-typing-dots");
    if(se){var labels={navigate:"navigating",click:"clicking",type:"typing",keypress:"pressing key",fill:"filling",scroll:"scrolling",screenshot:"capturing screenshot",snapshot:"reading page",wait:"waiting",evaluate:"evaluating",tab:"switching tab","default":"working"};se.textContent=(labels[actionType]||"working")+"...";}
    if(td){td.style.display=(actionType==="type"||actionType==="keypress")?"inline-flex":"none";}
    updatePrismaticColors(actionType);resetIdleTimer();
  }

  function removeOverlay(){if(!overlay)return;stopStateCheck();if(overlay.parentNode)overlay.parentNode.removeChild(overlay);overlay=null;}

  function stopBrowserPilot(){var c=window.confirm("Stop BrowserPilot?\n\nThis will end the current AI session and release control.");if(!c)return;console.log("[BrowserPilot] Stop confirmed");clearIdleTimer();removeOverlay();removePrismaticBurst();showBadge();try{chrome.runtime.sendMessage({type:"STOP_BROWSER"});}catch(e){}}

  function showBadge(){if(badge&&document.body.contains(badge))return;badge=document.createElement("div");badge.className="bp-badge";badge.innerHTML='<div class="bp-badge-dot"></div><div><div class="bp-badge-title">BrowserPilot</div><div class="bp-badge-sub">Ready</div></div>';badge.addEventListener("click",function(e){e.stopPropagation();try{chrome.runtime.sendMessage({type:"OPEN_SIDEBAR"});}catch(x){}});document.body.appendChild(badge);}
  function removeBadge(){if(badge&&badge.parentNode)badge.parentNode.removeChild(badge);badge=null;}

  function takeControl(){console.log("[BrowserPilot] Take Control clicked");clearIdleTimer();removeOverlay();removePrismaticBurst();showBadge();try{chrome.runtime.sendMessage({type:"USER_TAKEOVER"});}catch(e){}}

  chrome.runtime.onMessage.addListener(function(msg){
    if(msg.type==="LOCK_STATE"){
      var active=!!msg.active;currentTaskName=msg.taskName||currentTaskName;currentActionCount=(msg.actions||[]).length;
      var actionType=msg.lastActionType||"default";
      if(active){removeBadge();if(lastActiveState!==true){lastActiveState=true;console.log("[BrowserPilot] Session active");createOverlay();}updateStatus(currentTaskName,currentActionCount,actionType);}
      else{if(lastActiveState!==false){lastActiveState=false;console.log("[BrowserPilot] Session ended");clearIdleTimer();removeOverlay();removePrismaticBurst();showBadge();}}
    }
  });

  (async function(){
    try{var r=await fetch("http://localhost:3026/sidebar/state");var s=await r.json();lastActiveState=!!s.active;
    if(s.active){currentTaskName=s.taskName||"";currentActionCount=(s.actions||[]).length;var la=s.actions&&s.actions.length>0?s.actions[s.actions.length-1]:null;lastActionType=la?la.type:"default";createOverlay();updateStatus(currentTaskName,currentActionCount,lastActionType);}else{showBadge();}}catch(e){showBadge();}
    setTimeout(async function(){if(lastActiveState)return;try{var r2=await fetch("http://localhost:3026/sidebar/state");var s2=await r2.json();if(s2.active){lastActiveState=true;currentTaskName=s2.taskName||"";currentActionCount=(s2.actions||[]).length;var la2=s2.actions&&s2.actions.length>0?s2.actions[s2.actions.length-1]:null;lastActionType=la2?la2.type:"default";removeBadge();createOverlay();updateStatus(currentTaskName,currentActionCount,lastActionType);}}catch(x){}},4000);
  })();
})();