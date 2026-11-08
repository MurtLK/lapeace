// LAPEACE backend connector: adds Call Check (live), Who & where (census) and Home languages (FLEURS)
// tabs, and attaches the Speech Accent Archive audio from the backend to every clip.
// Backend address: ?backend=https://… in the URL, else the default below, else same origin when served by the backend.
(() => {
  const configured = new URLSearchParams(location.search).get('backend');
  let BACKEND = location.origin;
  if (configured) {
    try {
      const url = new URL(configured);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
      BACKEND = url.href.replace(/\/$/, '');
    } catch { console.warn('Invalid backend address; using this website origin.'); }
  }
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
    .lp-tab { display:none; } .lp-tab.on { display:block; }
    .lp-frame { width:100%; height:1000px; border:1px solid var(--line,#dfe4da); border-radius:18px; background:#0E1729; }
    .lp-row { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .lp-btn { display:inline-block; padding:10px 16px; border-radius:999px; background:var(--ink,#203d37); color:#fff; text-decoration:none; font-weight:600; }
    .lp-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; } @media (max-width:900px) { .lp-grid { grid-template-columns:1fr; } }
    .lp-big { font-size:44px; font-weight:700; color:var(--green,#426a53); margin:4px 0; }
    .lp-bar { height:10px; border-radius:5px; background:var(--green,#426a53); }
    .lp-table { width:100%; border-collapse:collapse; } .lp-table th, .lp-table td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line,#dfe4da); vertical-align:top; }
    .lp-table td.n, .lp-table th.n { text-align:right; font-variant-numeric:tabular-nums; }
    .lp-note { color:var(--muted,#7c8981); font-size:14px; }
    .lp-tag { display:inline-block; font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; background:var(--lime,#daf279); color:var(--ink,#203d37); vertical-align:middle; }
    .lp-ex { padding:14px 16px; border-radius:12px; background:#f0f2ec; margin:8px 0; font-size:18px; }`;
  document.head.appendChild(css);

  // --- New nav buttons + panels -------------------------------------------------------------
  const nav = $('aside nav');
  const tabs = [
    ['callcheck', '☎ &nbsp; Call Check <small class="lp-tag">LIVE</small>'],
    ['where', '◎ &nbsp; Who &amp; where'],
    ['languages', '◍ &nbsp; Home languages'],
  ];
  for (const [id, label] of tabs) {
    const b = document.createElement('button'); b.dataset.tab = id; b.innerHTML = label; nav.appendChild(b);
  }
  const footer = $('main footer');
  const panel = (id, html) => { const s = document.createElement('section'); s.id = `lp-${id}`; s.className = 'panel lp-tab'; s.innerHTML = html; footer.before(s); return s; };

  panel('callcheck', `<div class="lp-row"><div><h2>Call Check <span class="lp-tag">LIVE</span></h2>
      <p>Answer a call and speak, or take a call from an AI caller. ElevenLabs Scribe transcribes it live, the request is checked for scam red flags, and a prototype scores whether the voice sounds computer-generated.</p></div>
      <a class="lp-btn" href="${esc(BACKEND)}/call-check" target="_blank" rel="noopener">Open full screen ↗</a></div>
    <iframe class="lp-frame" title="LAPEACE Call Check" allow="microphone; autoplay" data-src="${esc(BACKEND)}/call-check"></iframe>
    <p class="lp-note">If the microphone doesn’t start inside this page, use “Open full screen”. The verdict comes from what the caller asks for (codes, gift cards, threats, secrecy); the voice score is only a hint.</p>`);

  panel('where', `<h2>Who and where in Mississauga?</h2>
    <p>2021 Census: residents who speak each language most often at home. These are population counts, kept separate from transcription error rates; they are <b>not</b> an estimate of how many residents voice AI misunderstands.</p>
    <div id="lp-census" class="lp-grid"><p class="lp-note">Loading census…</p></div>`);

  panel('languages', `<h2>How well does Scribe transcribe Mississauga’s home languages?</h2>
    <p>FLEURS read speech: the same 40 sentences in 14 languages, 560 of 560 clips scored. Scribe v2 was told each clip’s language. A separate benchmark from the accented-English one: don’t compare the two directly.</p>
    <table class="lp-table"><thead><tr><th>Language</th><th class="n">Median WER</th><th class="n">Mean WER</th><th class="n">Clips &gt; 5% WER</th><th>Recorded gender</th></tr></thead><tbody>
    ${[['Tamil','13.4','17.1','33','22 M / 18 F'],['Urdu','10.6','11.1','32','all F'],['Gujarati','8.2','9.6','27','27 M / 13 F'],['Punjabi','8.0','12.6','25','all F'],['Hindi','4.8','7.2','20','25 M / 15 F'],['Arabic (Egyptian)','4.6','7.6','18','all F'],['Tagalog','3.2','4.6','15','all M'],['Portuguese (BR)','0.0','2.7','10','all M'],['Polish','0.0','1.8','5','33 M / 7 F'],['English (US)','0.0','1.7','4','26 F / 14 M'],['Spanish (LatAm)','0.0','1.3','4','30 M / 10 F'],['Vietnamese','0.0','0.8','4','all M']]
      .map(([l,a,b,c,g]) => `<tr><td>${l}</td><td class="n">${a}%</td><td class="n">${b}%</td><td class="n">${c} / 40</td><td>${g}</td></tr>`).join('')}
    <tr><td>Mandarin</td><td colspan="4">No spaces between words, so character error is used: median 0.0%, mean 2.7%</td></tr>
    <tr><td>Cantonese</td><td colspan="4">Character error: median 0.0% once both sides use Simplified script (19.1% as written; Scribe outputs Simplified, the reference is Traditional)</td></tr>
    </tbody></table>
    <p class="lp-note">WER is harsher for long-word languages (Tamil, Gujarati, Urdu): one wrong letter makes the whole word wrong. Hindi and Urdu outputs often write English loanwords like “call” in English letters, which also counts as an error. No speaker IDs are given, so each language may come from only a few speakers.</p>
    <h3>Example for a fluent Punjabi speaker to review: pa_in_1555</h3>
    <div class="lp-ex"><b>What was said:</b> <span lang="pa">ਚਰਚ ਦੇ ਪਰਿਸਰ ਵਿੱਚ ਕੁਝ ਕਬਰਾਂ ਉੱਤੇ ਕੁਝ ਕਬੂਤਰਾਂ ਦੀਆਂ ਦਿਲਚਸਪ ਸੰਗਮਰਮਰ ਦੀਆਂ ਮੂਰਤੀਆਂ ਹਨ।</span></div>
    <div class="lp-ex"><b>Scribe (told “Punjabi”):</b> <span lang="bg">Църквите в перисъл изкуч кавра, у те куч кавутери биле девчас ки самарна диня мортиня.</span></div>
    <p class="lp-note">Scribe wrote the Punjabi sounds in Cyrillic letters and still reported “Punjabi, probability 1”.</p>`);

  // --- Tab switching (runs before the app's own handlers) ---------------------------------
  const own = new Set(tabs.map((t) => t[0]));
  const theirs = ['#overview', '#clips', '#settings', '.toolbar', '.notice', '#reference', 'section.heading'];
  let hiddenByUs = [];
  function show(id) {
    document.querySelectorAll('.lp-tab').forEach((s) => s.classList.toggle('on', s.id === `lp-${id}`));
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    hiddenByUs = theirs.map((sel) => $(sel)).filter((el) => el && !el.hidden);
    hiddenByUs.forEach((el) => (el.hidden = true));
    if (id === 'callcheck') { const f = $('#lp-callcheck iframe'); if (!f.src) f.src = f.dataset.src; }
    if (id === 'where') loadCensus();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (own.has(b.dataset.tab)) { e.stopPropagation(); e.preventDefault(); show(b.dataset.tab); return; }
    // Back to one of the app's own tabs: undo what we hid, then let the app switch as usual.
    document.querySelectorAll('.lp-tab').forEach((s) => s.classList.remove('on'));
    ['.toolbar', '.notice', 'section.heading'].forEach((sel) => { const el = $(sel); if (el) el.hidden = false; });
    hiddenByUs = [];
  }, true);

  // Direct links: …/#callcheck, …/#where, …/#languages
  const fromHash = () => { const h = location.hash.slice(1); if (own.has(h)) show(h); };
  window.addEventListener('hashchange', fromHash); setTimeout(fromHash, 0);

  // --- Census -------------------------------------------------------------------------------
  let censusLoaded = false;
  async function loadCensus() {
    if (censusLoaded) return; censusLoaded = true;
    try {
      let d;
      let snapshot = false;
      try {
        const response = await fetch(`${BACKEND}/api/census`);
        if (!response.ok) throw new Error('Census unavailable');
        d = await response.json();
        if (!Array.isArray(d.languages)) throw new Error('Invalid census data');
      } catch {
        const response = await fetch('census.json');
        if (!response.ok) throw new Error('Census snapshot unavailable');
        d = await response.json();
        snapshot = true;
      }
      $('#lp-census').innerHTML = d.languages.map((l) => {
        const max = Math.max(...l.wards.map((w) => w.residents));
        return `<div class="panel"><h3>${esc(l.language)}</h3><div class="lp-big">${l.city_total.toLocaleString()}</div><p class="lp-note">residents citywide</p>
          <table class="lp-table"><thead><tr><th>Ward</th><th class="n">Residents</th><th style="width:35%"></th><th class="n">% of city’s speakers</th></tr></thead><tbody>
          ${l.wards.map((w) => `<tr><td>Ward ${esc(w.geo)}</td><td class="n">${w.residents.toLocaleString()}</td><td><div class="lp-bar" style="width:${(w.residents / max) * 100}%"></div></td><td class="n">${w.share_of_city_speakers.toFixed(1)}%</td></tr>`).join('')}
          </tbody></table>
          <h4>Top neighbourhoods</h4><table class="lp-table"><tbody>${l.top_neighbourhoods.map((n) => `<tr><td>${esc(n.geo)}</td><td class="n">${n.residents.toLocaleString()}</td><td class="n">${n.pct_of_geo.toFixed(1)}% of residents</td></tr>`).join('')}</tbody></table></div>`;
      }).join('');
      if (snapshot) $('#lp-census').insertAdjacentHTML('afterbegin', '<p class="lp-note">Showing the bundled 2021 Census snapshot. The backend is not connected.</p>');
    } catch {
      censusLoaded = false;
      $('#lp-census').innerHTML = `<p>Couldn’t reach the LAPEACE backend at ${esc(BACKEND)}. Add <code>?backend=https://…</code> with the current address, or start the local backend.</p>`;
    }
  }

  // --- Audio: attach every Speech Accent Archive clip from the backend --------------------
  fetch(`${BACKEND}/api/samples`).then((r) => r.json()).then((d) => {
    if (typeof audio !== 'object' || !audio) return;
    for (const s of d.samples) {
      const file = s.audio_url ? decodeURIComponent(s.audio_url.split('/').pop()) : `${s.clip_id}.mp3`;
      if (!audio[file]) audio[file] = `${BACKEND}/audio/${encodeURIComponent(file)}`;
    }
  }).catch(() => {});
})();
