(() => {
  'use strict';
  const video = document.getElementById('game-footage');
  const surface = document.getElementById('game-surface');
  const hud = document.getElementById('game-hud');
  const prompt = document.createElement('button');
  prompt.id = 'airport-media-prompt';
  prompt.type = 'button';
  prompt.hidden = true;
  document.body.append(prompt);

  const source = {
    original: video.dataset.original || video.getAttribute('src') || 'media/airport.mp4',
    '720p': video.dataset.compact || video.dataset.mobile || 'media/airport-720.mp4'
  };
  const walkStart = 13.45;
  const approach = 28.0;
  const carNearby = 34.8;
  const carDoor = 37.15;
  const driving = 40.95;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const pauses = new Set();
  let active = false, boarded = false, gate = false, finished = false;
  let sprinting = false, x = 0, y = 0, rate = 1, sensitivity = 1;
  let fit = 'cover', volume = .65, mutedByBrowser = false;
  let quality = 'original', loadedQuality = 'original', pendingTime = null;
  let loading = false, failed = false, requiresTap = false, timer = 0;
  let attemptNumber = 0, playPending = false, sceneKey = '';
  let drag = null, offsetX = 0, offsetY = 0, panX = 0, panY = 0, scale = 1;

  function phase() {
    if (!active) return 'home';
    if (finished) return 'end';
    if (video.currentTime < walkStart) return 'arrival';
    if (!boarded) return 'walk';
    return video.currentTime < driving ? 'board' : 'drive';
  }
  function speeds() {
    const p = phase();
    const moving = p === 'walk' || p === 'drive';
    const boost = moving && sprinting ? 1.55 : 1;
    const pedal = moving ? (y < 0 ? 1 - .48*y : 1 - .75*y) : 1;
    video.playbackRate = clamp(rate*boost*pedal,.25,3);
  }
  function actionText() {
    switch (phase()) {
      case 'arrival': return 'Start at terminal';
      case 'walk': return video.currentTime >= carNearby ? 'Enter car' : (video.currentTime < approach ? 'Approach car' : 'Reach car');
      case 'board': return '';
      case 'drive': return pauses.has('brake') ? 'Drive' : 'Brake';
      case 'end': return 'Replay';
      default: return '';
    }
  }
  function updateHUD() {
    const p = phase(), action = actionText();
    const keyPrompt = gate || finished;
    const key = [p,action,keyPrompt,pauses.has('user')].join(':');
    if (sceneKey === key) return;
    sceneKey = key;
    hud.dataset.scene = p;
    hud.toggleAttribute('data-key-prompt', keyPrompt);
    window.GameHUD?.setAction(action);
    const drivingNow = p === 'drive';
    const jump = hud.querySelector('[data-gh="jump"]'), sprint = hud.querySelector('[data-gh="sprint"]');
    for (const [button,label] of [[jump,drivingNow?'Brake or drive (Space)':'Skip ahead five seconds (Space)'],[sprint,drivingNow?'Hold to accelerate (Shift)':'Hold to sprint (Shift)']]) {
      if (button) {button.setAttribute('aria-label',label); button.title=label;}
    }
    if(jump){if(drivingNow)jump.setAttribute('aria-pressed',String(pauses.has('brake')));else jump.removeAttribute('aria-pressed');}
    const transport = hud.querySelector('.duo-transport');
    if (transport) transport.dataset.paused = String(pauses.has('user') || finished);
    const toggle = hud.querySelector('[data-gh="playback"]');
    if(toggle){toggle.setAttribute('aria-label',pauses.has('user')||finished?'Resume playback':'Pause playback');toggle.title=pauses.has('user')||finished?'Play (P)':'Pause (P)';}
    speeds();
  }
  function mediaPrompt() {
    prompt.hidden = !active || pauses.has('menu') || (!failed && !requiresTap && (!mutedByBrowser || !volume));
    prompt.textContent = failed ? 'Retry video' : requiresTap ? 'Play' : 'Enable sound';
  }
  function blocked() {return !active || loading || failed || finished || gate || pauses.size || document.hidden;}
  function reconcile() {
    mediaPrompt(); updateHUD();
    if (blocked()) { if(!video.paused)video.pause(); return; }
    if (playPending || !video.paused || requiresTap) return;
    const attempt = ++attemptNumber;
    playPending = true;
    video.play().then(() => {
      if (attempt !== attemptNumber) return;
      playPending = false;
      if (blocked()) video.pause();
    }).catch(error => {
      if (attempt !== attemptNumber) return;
      playPending = false;
      if (error.name === 'NotAllowedError' && !video.muted) {
        mutedByBrowser = true; video.muted = true; reconcile();
      } else if (error.name === 'NotAllowedError') {
        requiresTap = true; mediaPrompt();
      } else if (error.name !== 'AbortError' && !video.error) {
        failed = true; mediaPrompt();
      }
    });
  }
  function changeQuality(q,force=false) {
    q = q==='720p'?'720p':'original';
    if (!force && q===loadedQuality && video.getAttribute('src')) return;
    const at = pendingTime ?? video.currentTime;
    loadedQuality = q; pendingTime = at; loading = true; failed = false;
    ++attemptNumber; playPending = false;
    video.src = source[q]; video.load();
    video.dispatchEvent(new Event('gamequalitychange')); mediaPrompt();
  }
  function setQuality(q) {
    quality = q === '720p' ? '720p' : 'original';
    if(active)changeQuality(quality);
  }
  function seek(t) {
    t = Math.max(0, Number.isFinite(video.duration) ? Math.min(t,video.duration-.025) : t);
    if (!boarded) t = Math.min(t,carDoor);
    if (video.readyState<1 || loading) pendingTime=t;
    else video.currentTime=t;
  }
  function resetCamera(){
    drag=null;offsetX=0;offsetY=0;updateView();
  }
  function updateView(){
    panX=clamp(offsetX+x*.05*sensitivity,-.11,.11);
    panY=clamp(offsetY,-.095,.095);
    scale=1+2*Math.max(Math.abs(panX),Math.abs(panY));
    video.style.transform=scale===1?'none':'translate('+(-panX*100)+'%, '+(-panY*100)+'%) scale('+scale+')';
    window.AirportVitals.layout();
  }
  function control(h,v) {
    if(!active)return;
    x = clamp(Number(h)||0,-1,1); y = clamp(Number(v)||0,-1,1);
    if (phase()==='drive' && y>.88) pauses.add('pedal'); else pauses.delete('pedal');
    if (phase()==='drive' && y<-.45) pauses.delete('brake');
    updateView(); speeds(); reconcile();
  }
  function tick(){
    if(!active)return;
    if(!boarded && !gate && video.currentTime >= carDoor){
      gate=true; video.pause(); seek(carDoor);
    }
    updateHUD();
  }
  function board(){
    boarded=true; gate=false; pauses.delete('user'); seek(carDoor); resetCamera(); reconcile();
  }
  function brake(){
    if(pauses.has('brake'))pauses.delete('brake');else pauses.add('brake');
    reconcile();
  }
  function performAction(){
    if(!active || pauses.has('menu'))return;
    switch(phase()){
      case 'arrival': seek(walkStart); break;
      case 'walk':
        if(video.currentTime>=carNearby)board();
        else seek(video.currentTime < approach ? approach : carNearby+.1);
        break;
      case 'drive': brake(); break;
      case 'end': restart(); break;
    }
    tick();reconcile();
  }
  function jump(){
    if(!active||pauses.has('menu'))return;
    if(phase()==='drive'){brake();return;}
    if(finished){restart();return;}
    if(phase()==='board'||gate)return;
    seek(video.currentTime+5); tick(); reconcile();
  }
  function initPlayback(){
    pendingTime=0;boarded=false;gate=false;finished=false;failed=false;requiresTap=false;sprinting=false;x=0;y=0;
    pauses.clear();sceneKey='';resetCamera();
    video.loop=false;video.playsInline=true;video.hidden=false;video.style.opacity='1';
    video.muted=mutedByBrowser||volume===0;video.volume=volume;
  }
  function start(){
    if(active)return;
    active=true;initPlayback();
    window.AirportVitals.start();
    window.GameHUD?.mount();window.GameHUD?.setStage('playing');sceneKey='';
    if(quality!==loadedQuality || !video.getAttribute('src') || video.error)changeQuality(quality,true);
    else if(video.readyState>=1){pendingTime=null;loading=false;seek(0);}
    else{loading=true;video.load();}
    clearInterval(timer);timer=setInterval(tick,40);reconcile();
  }
  function restart(){
    if(!active)return;
    initPlayback();
    if(video.error){changeQuality(quality,true);}
    else{pendingTime=null;seek(0);}
    window.GameHUD?.setStage('playing');reconcile();
  }
  function leave(){
    if(!active)return;
    active=false;clearInterval(timer);video.pause();++attemptNumber;playPending=false;
    window.AirportVitals.stop();
    window.GameHUD?.unmount();prompt.hidden=true;resetCamera();document.dispatchEvent(new Event('airport:leave'));
  }
  function togglePlayback(){
    if(!active)return;
    if(finished){restart();return;}
    if(gate){board();return;}
    if(pauses.has('user'))pauses.delete('user');else pauses.add('user');
    reconcile();
  }
  function snapshot() {
    if(!active || video.readyState<2 || !video.videoWidth)return null;
    const width=surface.clientWidth,height=surface.clientHeight;
    if(!width||!height)return null;
    const c=document.createElement('canvas');const factor=Math.min(1,1280/width);
    c.width=Math.round(width*factor);c.height=Math.round(height*factor);
    const ratio=(fit==='cover'?Math.max:Math.min)(c.width/video.videoWidth,c.height/video.videoHeight)*scale;
    const w=video.videoWidth*ratio,h=video.videoHeight*ratio,ctx=c.getContext('2d');
    ctx.fillStyle='#101116';ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(video,(c.width-w)/2-panX*c.width,(c.height-h)/2-panY*c.height,w,h);
    window.AirportVitals.snapshot(ctx,c.width,c.height);
    return c.toDataURL('image/jpeg',.87);
  }
  prompt.onclick=()=>{
    if(failed){changeQuality(quality,true);return;}
    requiresTap=false;mutedByBrowser=false;video.muted=volume===0;
    if(!blocked())video.play().catch(()=>{mutedByBrowser=true;video.muted=true;reconcile();});
    mediaPrompt();reconcile();
  };
  video.addEventListener('loadedmetadata',()=>{
    const desired=pendingTime;pendingTime=null;loading=false;failed=false;
    if(desired!==null&&Math.abs(video.currentTime-desired)>.025)seek(desired);
    video.dispatchEvent(new Event('gamequalitychange'));reconcile();
  });
  video.addEventListener('error',()=>{
    if(!video.error)return;
    if(active && loadedQuality==='original' && source['720p']!==source.original){changeQuality('720p',true);return;}
    failed=true;loading=false;playPending=false;mediaPrompt();
  });
  video.addEventListener('ended',()=>{if(active){finished=true;updateHUD();}});
  video.addEventListener('playing',()=>{requiresTap=false;mediaPrompt();});
  video.addEventListener('canplay',reconcile);
  video.addEventListener('timeupdate',tick);
  video.addEventListener('seeked',()=>{tick();reconcile();});
  surface.addEventListener('pointerdown',e=>{
    const cameraButton = e.button === 0 || (e.pointerType === 'mouse' && e.button === 2);
    if(!active||!cameraButton||pauses.has('menu')||drag)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:offsetX,oy:offsetY};
    surface.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('contextmenu',event=>{
    if(active&&!pauses.has('menu'))event.preventDefault();
  });
  surface.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    offsetX=clamp(drag.ox-(e.clientX-drag.x)/Math.max(surface.clientWidth,1)*.24*sensitivity,-.11,.11);
    offsetY=clamp(drag.oy-(e.clientY-drag.y)/Math.max(surface.clientHeight,1)*.2*sensitivity,-.095,.095);
    updateView();
  });
  const endDrag=e=>{if(drag?.id===e.pointerId)drag=null;};
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(ev,endDrag);
  surface.addEventListener('dblclick',resetCamera);
  function pause(){pauses.add('menu');reconcile();}
  function resume(){pauses.delete('menu');reconcile();}
  document.addEventListener('visibilitychange',reconcile);
  window.addEventListener('blur',()=>{if(active){sprinting=false;control(0,0);}});
  window.Player={
    pause,resume,leave,restart,togglePlayback,performAction,jump,control,snapshot,setQuality,
    sprint(on){sprinting=Boolean(on);speeds();},
    setFit(value){fit=value==='contain'?'contain':'cover';video.style.objectFit=fit;resetCamera();},
    setRate(value){rate=clamp(Number(value)||1,.25,3);speeds();},
    setSensitivity(value){sensitivity=clamp(Number(value)||1,.1,3);updateView();},
    setVolume(value){volume=clamp(Number(value)||0,0,1);video.volume=volume;video.muted=volume===0||mutedByBrowser;mediaPrompt();},
    qualityStatus(){return loadedQuality==='720p'?'720p · 60 fps':'Original · 1080p · 59.94 fps';},
    get stage(){return active?'playing':'home';},
    get scene(){return phase();},
    get paused(){return blocked()||video.paused;},
    get userPaused(){return pauses.has('user');}
  };
  document.addEventListener('airport:play',start);window.addEventListener('airport:play',start);
})();


