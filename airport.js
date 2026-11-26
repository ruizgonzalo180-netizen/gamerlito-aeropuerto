(() => {
 'use strict';
 const view=document.getElementById('game-view'),intro=document.getElementById('airport-intro'),opening=document.getElementById('opening-video');
 const skip=document.getElementById('skip-opening');
 const clips=['media/cover.mp4','media/ident.mp4'];
 let phase='entry',step=0,generation=0,timer=0;
 function clearIntro(){
  clearTimeout(timer);opening.onended=opening.onerror=opening.onplaying=null;
  opening.pause();opening.removeAttribute('src');opening.load();intro.hidden=true;
 }
 function play(){
  if(phase!=='intro')return;
  clearIntro();phase='game';view.focus({preventScroll:true});
  document.dispatchEvent(new Event('airport:play'));
 }
 function next(){
  if(phase!=='intro')return;
  clearTimeout(timer);
  if(step===clips.length){play();return;}
  const token=++generation;
  opening.onended=opening.onerror=()=>{if(phase==='intro'&&token===generation)next();};
  opening.onplaying=()=>clearTimeout(timer);
  opening.src=clips[step++];opening.load();
  const pending=opening.play();pending?.catch(()=>{if(phase==='intro'&&token===generation)next();});
  timer=setTimeout(()=>{if(phase==='intro'&&token===generation&&opening.readyState<2)next();},8000);
 }
 function join(){
  if(phase!=='entry')return;
  phase='intro';step=0;view.hidden=false;intro.hidden=false;next();
 }
 function leave(){
  if(phase==='entry')return;
  generation++;phase='entry';clearIntro();view.hidden=true;window.AirportEntry?.show();
 }
 skip.addEventListener('click',play);
 window.addEventListener('airport:joined',join);document.addEventListener('airport:joined',join);
 window.addEventListener('airport:leave',leave);document.addEventListener('airport:leave',leave);
})();
