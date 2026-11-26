(() => {
  'use strict';
  const video = document.getElementById('game-footage');
  const surface = document.getElementById('game-surface');
  const hud = document.getElementById('game-hud');

  // The plates cover only this source region, in coordinates of the 1920 × 1080 recording.
  const source = {x:28, y:16, width:204, height:100};
  function makeCanvas(id, parent) {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.hidden = true;
    parent.append(canvas);
    return canvas;
  }
  const repair = makeCanvas('airport-vitals-repair', surface);
  const indicators = makeCanvas('airport-vitals', hud);
  repair.setAttribute('aria-hidden','true');
  indicators.setAttribute('role','img');
  indicators.setAttribute('aria-label','Health and character status');
  const repairCtx = repair.getContext('2d');
  const indicatorsCtx = indicators.getContext('2d');
  const images = new Map();
  let manifest, manifestPromise, active = false, callback = 0, lastTime = 0, painted = -1;
  let placement;

  function prepare() {
    if (manifest) { requestPage(0); return; }
    if (!manifestPromise) {
      manifestPromise = fetch('entry/vitals-frames.json').then(response => {
        if (!response.ok) throw new Error('Vitals data unavailable');
        return response.json();
      }).then(data => {
        manifest = data;
        requestPage(0);
        if (active) paint(lastTime);
      }).catch(() => { manifestPromise = null; });
    }
  }
  function requestPage(page) {
    if (!manifest || page < 0 || page >= manifest.pageCount) return;
    const prior = images.get(page);
    if (prior && (!prior.failed || performance.now() < prior.retryAt)) return prior;
    const entry = {image:new Image(), ready:false};
    images.set(page,entry);
    entry.image.decoding = 'async';
    const loaded = () => {
      entry.ready = true;
      if (active && images.get(page) === entry) paint(lastTime);
    };
    entry.image.onload = () => {
      if (entry.image.decode) entry.image.decode().then(loaded,loaded);
      else loaded();
    };
    entry.image.onerror = () => {
      entry.failed = true; entry.retryAt = performance.now() + 2000;
    };
    entry.image.src = 'entry/vitals-' + page + '.webp';
    return entry;
  }
  function clear() {
    if (painted !== -1) indicators.hidden = repair.hidden = true;
    painted = -1;
  }
  function layout() {
    const box = video.getBoundingClientRect(), viewport = surface.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const fit = video.style.objectFit === 'contain' ? Math.min : Math.max;
    const ratio = fit(box.width/1920, box.height/1080);
    placement = {
      x: box.left - viewport.left + (box.width - 1920*ratio)/2 + source.x*ratio,
      y: box.top - viewport.top + (box.height - 1080*ratio)/2 + source.y*ratio,
      w: source.width*ratio, h: source.height*ratio
    };
    Object.assign(repair.style, {
      left:placement.x+'px', top:placement.y+'px',
      width:placement.w+'px', height:placement.h+'px'
    });
  }
  function drawPlate(index, entry) {
    if (painted === index) return;
    const column = index % 8, row = Math.floor(index / 8) % 8;
    const sx = column * source.width, sy = row * source.height * 2;
    for (const [context,offset] of [[repairCtx,0],[indicatorsCtx,source.height]]) {
      context.clearRect(0,0,source.width,source.height);
      context.drawImage(entry.image,sx,sy+offset,source.width,source.height,0,0,source.width,source.height);
    }
    if (!placement) layout();
    painted = index;
    repair.hidden = indicators.hidden = false;
  }
  function paint(time) {
    lastTime = time;
    if (!active || !manifest) return;
    const range = manifest.ranges.find(([,end]) => time < end);
    if (!range || time < range[0]) {
      clear();
      if (range && range[0]-time < 6) requestPage(Math.floor(range[2]/64));
      return;
    }
    const first = range[2], end = first+range[3];
    let lo = first, hi = end;
    while (lo+1 < hi) {
      const mid = (lo+hi) >> 1;
      if (manifest.times[mid] <= time+.0001) lo=mid; else hi=mid;
    }
    const page = Math.floor(lo/64);
    // Two nearby sheets stay decoded; completed sections can be reclaimed on iPad.
    for (const cached of images.keys()) {
      if (cached !== page && cached !== page+1) images.delete(cached);
    }
    const entry = requestPage(page);
    if (lo+44 >= (page+1)*64 && (page+1)*64 < end) requestPage(page+1);
    if (entry?.ready) drawPlate(lo,entry); else clear();
  }
  function frame(now, metadata) {
    if (!active) return;
    paint(metadata ? metadata.mediaTime : video.currentTime);
    schedule();
  }
  function schedule() {
    callback = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
  }
  function start() {
    if (active) return;
    active = true;
    layout();
    prepare();
    paint(video.currentTime);
    schedule();
  }
  function stop() {
    active = false;
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callback); else cancelAnimationFrame(callback);
    callback = 0; placement = null; images.clear(); clear();
  }
  function snapshot(ctx,width,height) {
    if (painted < 0) return;
    const v=surface.getBoundingClientRect();
    for (const canvas of [repair,indicators]) {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(canvas,(rect.left-v.left)*width/v.width,(rect.top-v.top)*height/v.height,rect.width*width/v.width,rect.height*height/v.height);
    }
  }

  window.addEventListener('airport:play-requested',prepare);
  new ResizeObserver(layout).observe(surface);
  video.addEventListener('emptied',clear);
  video.addEventListener('seeking',clear);
  for (const event of ['loadeddata','seeked','pause']) {
    video.addEventListener(event, () => { if (active && video.readyState>=2) paint(video.currentTime); });
  }
  window.AirportVitals = {start,stop,layout,snapshot};
})();
