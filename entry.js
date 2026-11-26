(() => {
  'use strict';
  const desktop = document.getElementById('airport-desktop');
  const launcher = document.getElementById('launcher');
  const launchButton = document.getElementById('airport-launch');
  const opening = document.getElementById('airport-opening');
  const joinScreen = document.getElementById('airport-join');
  const cancel = document.getElementById('airport-cancel');
  const override = new URLSearchParams(location.search).get('device');
  const isTablet = /iPad|iPhone|Android/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const tablet = override === 'ipad' || (override !== 'pc' && isTablet);
  document.documentElement.dataset.airportDevice = tablet ? 'ipad' : 'pc';
  let stage = tablet ? 'home' : 'desktop';
  let openingLimit;
  let joinLimit;
  // Time from pressing Play to the first playable frame in the Roblox recording.
  const joinDuration = (2528 - 2203) * 1000 / 60;

  function clearScreens() {
    clearTimeout(openingLimit);
    clearTimeout(joinLimit);
    opening.onended = opening.onerror = opening.onplaying = null;
    opening.pause();
    if (opening.readyState && opening.currentTime) opening.currentTime = 0;
    opening.hidden = true;
    joinScreen.hidden = true;
    joinScreen.classList.remove('airport-controls-visible');
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
    stage = 'opening';
    launchButton.disabled = true;
    opening.hidden = false;
    const finish = () => { if (stage === 'opening') show(); };
    opening.onended = opening.onerror = finish;
    opening.onplaying = () => clearTimeout(openingLimit);
    openingLimit = setTimeout(finish, 6500);
    opening.play().catch(finish);
  }
  function join() {
    if (stage === 'joining' || stage === 'game') return;
    stage = 'joining';
    joinScreen.hidden = false;
    desktop.hidden = true;
    launcher.hidden = true;
    window.AirportLobby?.hide();
    joinScreen.focus({preventScroll: true});
    window.dispatchEvent(new Event('airport:play-requested'));
    joinLimit = setTimeout(() => {
      if (stage !== 'joining') return;
      stage = 'game';
      window.dispatchEvent(new Event('airport:joined'));
      joinScreen.hidden = true;
      joinScreen.classList.remove('airport-controls-visible');
    }, joinDuration);
  }
  function cancelJoin() {
    if (stage !== 'joining') return;
    show('details');
    launcher.querySelector('[data-lx="play"]')?.focus({preventScroll:true});
  }
  window.AirportEntry = {show, join};
  cancel.addEventListener('click', cancelJoin);
  joinScreen.addEventListener('pointerdown', event => {
    if (!event.target.closest('button')) joinScreen.classList.toggle('airport-controls-visible');
  });
  document.addEventListener('keydown', event => {
    if (stage === 'joining' && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelJoin();
    }
  }, true);
  desktop.hidden = tablet;
  launcher.hidden = !tablet;
  launchButton.addEventListener('click', startOpening);
  const initialize = () => {
    if (stage === 'home') show();
    else if (stage === 'desktop' || stage === 'opening') window.AirportLobby.hide();
  };
  if (window.AirportLobby) initialize();
  else import('./launcher.js?v=logo-entry3').then(initialize).catch(() => {
    launcher.innerHTML = '<p role="alert">The launcher could not load. <button type="button">Try again</button></p>';
    launcher.querySelector('button').onclick = () => location.reload();
  });
})();
