(() => {
  'use strict';
  const desktop = document.getElementById('airport-desktop');
  const launcher = document.getElementById('launcher');
  const launchButton = document.getElementById('airport-launch');
  const opening = document.getElementById('airport-opening');
  const joinScreen = document.getElementById('airport-join');
  const status = document.getElementById('airport-status');
  const cancel = document.getElementById('airport-cancel');
  const override = new URLSearchParams(location.search).get('device');
  const touch = /iPad|iPhone|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && (navigator.platform === 'MacIntel' || matchMedia('(pointer: coarse)').matches));
  const tablet = override === 'ipad' || (override !== 'pc' && touch);
  let stage = tablet ? 'home' : 'desktop';
  let timer = 0;
  let fade = 0;
  let scrollTimer = 0;
  let openingLimit = 0;

  function clearOpening() {
    clearTimeout(openingLimit);
    opening.onended = opening.onerror = null;
    opening.pause();
    if (opening.hasAttribute('src')) {
      opening.removeAttribute('src');
      opening.load();
    }
    opening.hidden = true;
    launchButton.disabled = false;
  }
  function clearJoin() {
    clearTimeout(timer);
    clearTimeout(fade);
    joinScreen.hidden = true;
    joinScreen.classList.remove('airport-joining-end');
  }
  function show(page = 'home') {
    clearTimeout(scrollTimer);
    clearOpening();
    clearJoin();
    stage = page;
    desktop.hidden = true;
    launcher.hidden = false;
    window.AirportLobby?.show(page);
    if (page === 'home') {
      // The recording scrolls past the event before selecting the game.
      const content = document.getElementById('lx-content');
      const interrupted = () => clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (stage !== 'home' || content.scrollTop > 2 || !content.querySelector('.airport-event')) return;
        const section = content.querySelector('.airport-event + .lx-section');
        if (!section) return;
        const inset = content.querySelector('.lx-tabs').offsetHeight;
        const top = section.getBoundingClientRect().top - content.getBoundingClientRect().top - inset - 10;
        content.scrollTo({top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      }, 850);
      content.addEventListener('pointerdown', interrupted, {once:true, passive:true});
      content.addEventListener('wheel', interrupted, {once:true, passive:true});
    }
  }
  function startOpening() {
    if (stage !== 'desktop') return;
    stage = 'opening';
    launchButton.disabled = true;
    opening.hidden = false;
    opening.src = 'entry/opening.mp4';
    const finish = () => { if (stage === 'opening') show(); };
    opening.onended = opening.onerror = finish;
    openingLimit = setTimeout(finish, 5500);
    opening.play().catch(finish);
  }
  function join() {
    if (stage === 'joining' || stage === 'game') return;
    clearTimeout(scrollTimer);
    window.dispatchEvent(new Event('airport:play-requested'));
    window.AirportLobby?.hide();
    desktop.hidden = true;
    joinScreen.hidden = false;
    joinScreen.classList.remove('airport-joining-end');
    status.textContent = 'Joining server';
    stage = 'joining';
    cancel.focus({preventScroll:true});
    fade = setTimeout(() => joinScreen.classList.add('airport-joining-end'), 4300);
    timer = setTimeout(() => {
      if (stage !== 'joining') return;
      clearJoin();
      stage = 'game';
      window.dispatchEvent(new Event('airport:joined'));
    }, 4950);
  }
  function cancelJoin() {
    if (stage !== 'joining') return;
    show('details');
    launcher.querySelector('[data-lx="play"]')?.focus({preventScroll:true});
  }
  window.AirportEntry = {show, join};
  cancel.addEventListener('click', cancelJoin);
  document.addEventListener('keydown', event => {
    if (stage === 'joining' && event.key === 'Escape') {
      event.preventDefault();
      cancelJoin();
    }
  }, true);
  document.documentElement.dataset.airportDevice = tablet ? 'ipad' : 'pc';
  desktop.hidden = tablet;
  launcher.hidden = !tablet;
  launchButton.addEventListener('click', startOpening);
  const initialize = () => {
    if (stage === 'home') show();
    else if (stage === 'desktop' || stage === 'opening') window.AirportLobby.hide();
  };
  if (window.AirportLobby) initialize();
  else import('./launcher.js').then(initialize).catch(() => {
    launcher.innerHTML = '<p role="alert">The launcher could not load. <button type="button">Try again</button></p>';
    launcher.querySelector('button').onclick = () => location.reload();
  });
})();
