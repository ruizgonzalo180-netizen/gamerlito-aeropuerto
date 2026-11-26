(() => {
  'use strict';
  const hud = document.getElementById('game-hud');
  const video = document.getElementById('game-footage');
  const phrases = {
    en: ["Hey!", "Let's go!", "Nice ride!", "GG"],
    es: ["¡Hola!", "¡Vamos!", "¡Qué buen auto!", "Buena partida"],
    pt: ["Oi!", "Vamos!", "Belo carro!", "Bom jogo"]
  };
  const settingsKey = 'gamerlito.airport.chat-language';
  let language = 'en', translate = true, outputId = '';
  try {
    const prefs = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    if (Object.hasOwn(phrases, prefs.language)) language = prefs.language;
    if (typeof prefs.translate === 'boolean') translate = prefs.translate;
  } catch { /* Storage may be disabled in private browsing. */ }
  function updateTranslations() {
    for (const button of hud.querySelectorAll('[data-phrase]')) {
      const i = phrases.en.indexOf(button.dataset.phrase);
      if (i !== -1) button.textContent = phrases[translate ? language : 'en'][i];
    }
    for (const line of hud.querySelectorAll('.gh-messages p:has(strong)')) {
      const text = line.lastChild;
      if (text?.nodeType !== Node.TEXT_NODE) continue;
      const i = line.dataset.phraseIndex ?? phrases.en.indexOf(text.nodeValue);
      if (+i < 0) continue;
      line.dataset.phraseIndex = i;
      const next = phrases[translate ? language : 'en'][i];
      if (text.nodeValue !== next) text.nodeValue = next;
    }
  }
  new MutationObserver(updateTranslations).observe(hud.querySelector('.gh-messages'), {childList:true});
  updateTranslations();
  function addArrows(select) {
    const wrapper = document.createElement('span');
    const label = select.labels?.[0]?.querySelector('span')?.textContent || select.getAttribute('aria-label') || 'option';
    function arrow(step) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.menuStep = step;
      button.setAttribute('aria-label', (step < 0 ? 'Previous ' : 'Next ') + label);
      button.addEventListener('click', event => {
        event.preventDefault();
        select.selectedIndex = (select.selectedIndex + step + select.length) % select.length;
        select.dispatchEvent(new Event('change', {bubbles:true}));
      });
      return button;
    }
    wrapper.className = 'gh-setting-options';
    select.setAttribute('aria-label',label);
    select.replaceWith(wrapper);
    wrapper.append(arrow(-1), select, arrow(1));
  }
  async function outputOptions(select) {
    if (!navigator.mediaDevices?.enumerateDevices || !video.setSinkId) return;
    try {
      const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default');
      for (const [index,device] of outputs.entries()) select.add(new Option(device.label || 'Audio output '+(index+1), device.deviceId));
      select.value = outputId;
      select.disabled = outputs.length === 0;
    } catch { /* The browser still routes sound through the system output. */ }
  }
  function settings(content) {
    const firstPicker = content.querySelector('[data-pref="feedback"]').closest('.gh-row');
    firstPicker.insertAdjacentHTML('beforebegin',
      '<label class="gh-row"><span>Output Device</span><select class="gh-output" aria-label="Output Device" disabled><option value="">System default</option></select></label>' +
      '<h2>Chat &amp; Language</h2>' +
      '<label class="gh-row"><span>Automatic Chat Translation</span><select data-menu-language="enabled"><option value="true">On</option><option value="false">Off</option></select></label>' +
      '<label class="gh-row"><span>Chat Translation Language</span><select data-menu-language="locale"><option value="en">English (United States)</option><option value="es">Spanish</option><option value="pt">Portuguese (Brazil)</option></select></label>');
    content.querySelector('[data-menu-language=enabled]').value = String(translate);
    content.querySelector('[data-menu-language=locale]').value = language;
    const output = content.querySelector('.gh-output');
    outputOptions(output);
    output.addEventListener('change',async () => {
      const selected = output.value;
      try { await video.setSinkId(selected); outputId = selected; }
      catch { output.value = outputId; }
    });
    for (const select of content.querySelectorAll('select[data-pref],select[data-menu-language=enabled]')) addArrows(select);
  }
  function people(content) {
    content.querySelector('.gh-heading').insertAdjacentHTML('beforebegin',
      '<button type="button" class="gh-recorded-invite" aria-controls="gh-recorded-share" aria-expanded="false"><i aria-hidden="true"></i>Invite Friends</button>' +
      '<div class="gh-recorded-share" id="gh-recorded-share" hidden><input aria-label="Invite link" readonly><button class="gh-action" type="button">Copy link</button><span role="status"></span></div>');
    const invite = content.querySelector('.gh-recorded-invite'), panel = content.querySelector('.gh-recorded-share'), input = panel.querySelector('input');
    const url = new URL(location.href);
    url.search = ''; url.hash = '';
    input.value = url.href;
    invite.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      invite.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) { input.focus({preventScroll:true}); input.select(); }
    });
    panel.querySelector('button').addEventListener('click',async () => {
      const status = panel.querySelector('[role=status]');
      try { await navigator.clipboard.writeText(url.href); status.textContent = 'Copied'; }
      catch { input.focus(); input.select(); status.textContent = 'Select and copy this link'; }
    });
  }
  hud.addEventListener('change', event => {
    const setting = event.target.dataset.menuLanguage;
    if (!setting) return;
    if (setting === 'locale' && Object.hasOwn(phrases, event.target.value)) language = event.target.value;
    if (setting === 'enabled') translate = event.target.value === 'true';
    try { localStorage.setItem(settingsKey, JSON.stringify({language,translate})); } catch {}
    updateTranslations();
  });
  window.RecordedMenu = {enhance(content) {
    const avatar = content.querySelector('.gh-player img');
    if (avatar) avatar.src = 'recorded-menu/avatar.webp';
    if (content.querySelector('[data-pref="feedback"]')) settings(content);
    if (content.querySelector('.gh-heading .gh-row-switch')) people(content);
  }};
})();
