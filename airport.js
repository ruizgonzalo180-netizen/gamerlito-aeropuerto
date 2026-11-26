(() => {
  'use strict';
  const view = document.getElementById('game-view');
  const footage = document.getElementById('game-footage');

  // Safari grants media playback during the tap, before the recorded join sequence.
  document.addEventListener('click', event => {
    if (!view.hidden || !event.isTrusted || !event.target.closest('[data-lx="play"], [data-lx="quick-play"]')) return;
    footage.preload = 'auto';
    const ready = footage.play();
    footage.pause();
    ready?.catch(() => {});
  }, true);

  window.addEventListener('airport:play-requested', () => {
    footage.preload = 'auto';
  });

  window.addEventListener('airport:joined', () => {
    if (!view.hidden) return;
    view.hidden = false;
    view.focus({preventScroll: true});
    document.dispatchEvent(new Event('airport:play'));
  });

  document.addEventListener('airport:leave', () => {
    if (view.hidden) return;
    view.hidden = true;
    window.AirportEntry.show();
  });
})();
