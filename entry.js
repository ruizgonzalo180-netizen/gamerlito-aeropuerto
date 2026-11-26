(() => {
  'use strict';
  const desktop = document.getElementById('airport-desktop');
  const launcher = document.getElementById('launcher');
  const launchButton = document.getElementById('airport-launch');
  const opening = document.getElementById('airport-opening');
  const joinScreen = document.getElementById('airport-join');
  const joinMovie = document.getElementById('airport-join-movie');
  const joinStill = document.getElementById('airport-join-still');
  const status = document.getElementById('airport-status');
  const cancel = document.getElementById('airport-cancel');
  const whiteClose = document.getElementById('airport-white-close');
  const override = new URLSearchParams(location.search).get('device');
  const isTablet = /iPad|iPhone|Android/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const tablet = override === 'ipad' || (override !== 'pc' && isTablet);
  document.documentElement.dataset.airportDevice = tablet ? 'ipad' : 'pc';
  let stage = tablet ? 'home' : 'desktop';
  let generation = 0;
  let openingLimit;
  let joinLimit;
  let transition;
  let fallback = false;
  let fallbackStart = 0;
  let fallbackFrame;
  // The recorded Play release precedes the white status page by three frames at 60 fps.
  const pressedDuration = 50;
  const statusDuration = (2248 - 2206) / 60;
  const joinDuration = (2528 - 2206) / 60;

  function reset(video) {
    video.pause();
    if (video.readyState && video.currentTime !== 0) video.currentTime = 0;
  }
  function clearScreens() {
    generation++;
    clearTimeout(openingLimit);
    clearTimeout(transition);
    clearTimeout(joinLimit);
    cancelAnimationFrame(fallbackFrame);
    fallback = false;
    opening.onended = opening.onerror = opening.onplaying = null;
    joinMovie.onended = joinMovie.onerror = joinMovie.onplaying = null;
    joinMovie.ontimeupdate = joinMovie.onwaiting = joinMovie.onstalled = null;
    reset(opening);
    reset(joinMovie);
    opening.hidden = joinScreen.hidden = true;
    joinMovie.hidden = false;
    joinStill.hidden = true;
    joinScreen.classList.remove('airport-controls-visible');
    joinStill.classList.remove('airport-still-end');
    launchButton.disabled = false;
  }
  function show(page = 'home') {
    clearScreens();
    stage = page;
    desktop.hidden = true;
    launcher.hidden = false;
    window.AirportLobby?.show(page);
  }
  function startOpening() {
    if (stage !== 'desktop') return;
    const token = ++generation;
    stage = 'opening';
    launchButton.disabled = true;
    opening.hidden = false;
    const finish = () => { if (token === generation && stage === 'opening') show(); };
    opening.onended = opening.onerror = finish;
    opening.onplaying = () => clearTimeout(openingLimit);
    openingLimit = setTimeout(finish, 6500);
    opening.play().catch(finish);
  }
  function finishJoin() {
    if (stage !== 'joining') return;
    clearScreens();
    stage = 'game';
    window.dispatchEvent(new Event('airport:joined'));
  }
  function setRecordedStatus(time) {
    whiteClose.hidden = time >= statusDuration;
    const label = time < statusDuration ? 'Opening experience' : time < 4.6 ? 'Waiting for an available server' : 'Joining server';
    if (status.textContent !== label) status.textContent = label;
  }
  function startFallback() {
    if (stage !== 'joining' || fallback) return;
    fallback = true;
    clearTimeout(joinLimit);
    const elapsed = joinMovie.currentTime || 0;
    joinMovie.pause();
    joinMovie.hidden = true;
    joinStill.hidden = false;
    fallbackStart = performance.now() - elapsed * 1000;
    function tick() {
      if (!fallback || stage !== 'joining') return;
      const t = (performance.now() - fallbackStart) / 1000;
      if (t >= joinDuration) { finishJoin(); return; }
      setRecordedStatus(t);
      const still = t < statusDuration ? 'entry/joining-first.webp' : 'entry/joining-fallback.webp';
      if (joinStill.getAttribute('src') !== still) joinStill.setAttribute('src',still);
      joinStill.classList.toggle('airport-still-end', t >= 4.8);
      fallbackFrame = requestAnimationFrame(tick);
    }
    tick();
  }
  function join() {
    if (stage === 'joining' || stage === 'game') return;
    stage = 'joining';
    const token = ++generation;
    window.dispatchEvent(new Event('airport:play-requested'));
    desktop.hidden = true;
    transition = setTimeout(() => {
      if (generation !== token) return;
      window.AirportLobby?.hide();
      joinScreen.hidden = false;
      joinScreen.focus({preventScroll:true});
      setRecordedStatus(0);
      const guard = () => { if (token === generation) startFallback(); };
      const waiting = () => {
        clearTimeout(joinLimit);
        joinLimit = setTimeout(guard, 6500);
      };
      joinMovie.onplaying = () => clearTimeout(joinLimit);
      joinMovie.onwaiting = joinMovie.onstalled = waiting;
      joinMovie.ontimeupdate = () => { if (!fallback) setRecordedStatus(joinMovie.currentTime); };
      joinMovie.onended = () => { if (generation === token) finishJoin(); };
      joinMovie.onerror = guard;
      waiting();
      joinMovie.play().catch(guard);
    }, pressedDuration);
  }
  function cancelJoin() {
    if (stage !== 'joining') return;
    show('details');
    launcher.querySelector('[data-lx="play"]')?.focus({preventScroll:true});
  }
  window.AirportEntry = {show, join};
  cancel.addEventListener('click', cancelJoin);
  whiteClose.addEventListener('click', cancelJoin);
  joinScreen.addEventListener('pointerdown', event => {
    if (!event.target.closest('button')) joinScreen.classList.toggle('airport-controls-visible');
  });
  document.addEventListener('keydown', event => {
    if (stage === 'joining' && event.key === 'Escape') { event.preventDefault(); cancelJoin(); }
  }, true);
  desktop.hidden = tablet;
  launcher.hidden = !tablet;
  launchButton.addEventListener('click', startOpening);
  const initialize = () => {
    if (stage === 'home') show();
    else if (stage === 'desktop' || stage === 'opening') window.AirportLobby.hide();
  };
  if (window.AirportLobby) initialize();
  else import('./launcher.js?v=recording2').then(initialize).catch(() => {
    launcher.innerHTML = '<p role="alert">The launcher could not load. <button type="button">Try again</button></p>';
    launcher.querySelector('button').onclick = () => location.reload();
  });
})();
