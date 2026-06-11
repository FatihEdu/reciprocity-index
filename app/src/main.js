const DEFAULT_STATUS_WEIGHT = {
  visa_free: 0,
  electronic_travel_authorisation: 1,
  visa_on_arrival: 3,
  visa_online: 4,
  visa_required: 10,
};

const I18N = {
  tr: {
    title: 'Mütekabiliyet Endeksi',
    description: 'Bir ülke senden vize istiyorsa, sen de ondan vize istiyor musun?',
    noteLabel: 'Not:',
    noteText: 'Buna daha ağır bir dille “Kapitülasyon Endeksi” de diyebiliriz.',
    loading: 'Yükleniyor...',
    originCount: 'Ülke sayısı',
    lastChange: 'Son veri değişimi',
    missingDate: 'bilinmiyor',
    headingGlobal: 'Küresel Sıralama',
    headingDetail: 'Mütekabiliyet Detayları',
    country: 'Ülke',
    badge: 'Etiket',
    globalScore: 'Toplam skor',
    averageScore: 'Ortalama',
    score: 'Skor',
    statusYouToThem: 'Sen → onlar',
    statusThemToYou: 'Onlar → sen',
    errorPrefix: 'Hata: ',
    backBtn: '← Küresel sıralamaya dön',
    filterLabel: 'Filtre:',
    filterAll: 'Tümü',
    filterSchengen: 'Sadece Schengen',
    filterNotSchengen: 'Schengen Hariç',
    filterCustomInc: 'Özel (Sadece Seçilenler)',
    filterCustomExc: 'Özel (Seçilenler Hariç)',
    customSelectHelp: 'Birden fazla ülke seçmek için Ctrl/Cmd tuşuna basılı tutun.',
    clickHint: 'Detay için ülkeye tıkla.',
    noResults: 'Sonuç bulunamadı.',
    pairs: 'karşılaştırma',
    worstAvgChart: 'En düşük ortalama skorlar',
    filteredChart: 'Bu listedeki skor dağılımı',
    unfairTitle: 'Onlar bize daha rahat geliyor; biz onlara daha zor gidiyoruz',
    strictTitle: 'Biz onlara daha sertiz; onlar bize daha zor geliyor',
    reciprocalTitle: 'Tam mütekabil örnekler',
    summaryNegative: 'Mütekabiliyetsiz açık',
    summaryPositive: 'Ters yönde açık',
    summaryZero: 'Mütekabil',
    historyTitle: 'Bu ülkenin geçmişi',
    historyEmpty: 'Bu ülke için henüz geçmiş değişim yok. Veri bugünden itibaren birikecek.',
    historyLoading: 'Geçmiş yükleniyor...',
    historyUnsupported: 'Tarayıcı gzip history paketini açamadı. Grafik veri biriktikçe eklenecek.',
    badgeEgoist: 'egoist',
    badgeUnreciprocal: 'mütekabiliyetsiz',
    badgeReciprocal: 'mütekabil',
    badgePositive: 'sert taraf',
    badgeNegative: 'açık veren',
    badgeNeutral: 'orta',
    status: {
      visa_free: 'vizesiz',
      electronic_travel_authorisation: 'ETA',
      visa_on_arrival: 'kapıda vize',
      visa_online: 'online vize',
      visa_required: 'vize gerekli',
    },
  },
  en: {
    title: 'Reciprocity Index',
    description: 'If a country requires a visa from you, do you also require a visa from it?',
    noteLabel: 'Note:',
    noteText: 'In a heavier tone, you could also call this the “Capitulation Index.”',
    loading: 'Loading...',
    originCount: 'Country count',
    lastChange: 'Last data change',
    missingDate: 'unknown',
    headingGlobal: 'Global Ranking',
    headingDetail: 'Reciprocity Details',
    country: 'Country',
    badge: 'Badge',
    globalScore: 'Total score',
    averageScore: 'Average',
    score: 'Score',
    statusYouToThem: 'You → them',
    statusThemToYou: 'Them → you',
    errorPrefix: 'Error: ',
    backBtn: '← Back to global ranking',
    filterLabel: 'Filter:',
    filterAll: 'All',
    filterSchengen: 'Schengen Only',
    filterNotSchengen: 'Except Schengen',
    filterCustomInc: 'Custom (Include Only)',
    filterCustomExc: 'Custom (Exclude)',
    customSelectHelp: 'Hold Ctrl/Cmd to select multiple countries.',
    clickHint: 'Click a country for details.',
    noResults: 'No results found.',
    pairs: 'pairs',
    worstAvgChart: 'Lowest average scores',
    filteredChart: 'Score distribution for this list',
    unfairTitle: 'They enter us more easily; we enter them with more difficulty',
    strictTitle: 'We are stricter to them; they enter us with more difficulty',
    reciprocalTitle: 'Fully reciprocal examples',
    summaryNegative: 'Reciprocity deficit',
    summaryPositive: 'Reverse deficit',
    summaryZero: 'Reciprocal',
    historyTitle: 'Country history',
    historyEmpty: 'No historical change for this country yet. Data will accumulate from now on.',
    historyLoading: 'Loading history...',
    historyUnsupported: 'Browser could not open the gzip history pack. Chart will fill as data accumulates.',
    badgeEgoist: 'egoist',
    badgeUnreciprocal: 'unreciprocal',
    badgeReciprocal: 'reciprocal',
    badgePositive: 'strict side',
    badgeNegative: 'open side',
    badgeNeutral: 'middle',
    status: {
      visa_free: 'visa-free',
      electronic_travel_authorisation: 'ETA',
      visa_on_arrival: 'visa on arrival',
      visa_online: 'online visa',
      visa_required: 'visa required',
    },
  },
};

function detectLanguage() {
  const param = new URLSearchParams(window.location.search).get('lang');
  const stored = window.localStorage.getItem('reciprocity-language');
  const candidate = (param || stored || navigator.language || 'tr').toLowerCase();
  return candidate.startsWith('en') ? 'en' : 'tr';
}

function setLanguage(lang) {
  const next = lang === 'en' ? 'en' : 'tr';
  window.localStorage.setItem('reciprocity-language', next);
  document.documentElement.lang = next;
  document.documentElement.dataset.lang = next;
  return next;
}

function t(lang, key) {
  return I18N[lang][key];
}

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return await res.text();
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return await res.json();
}

async function fetchJsonOptional(path) {
  try {
    return await fetchJson(path);
  } catch (_err) {
    return null;
  }
}

function parseJsonl(text) {
  return text.trim().split(/\n+/).filter(Boolean).map(line => JSON.parse(line));
}

function buildStatusMap(rows) {
  const map = {};
  for (const row of rows) map[row.code] = row;
  return map;
}

function pairScore(a, b, status, weights = DEFAULT_STATUS_WEIGHT) {
  const aToB = status[a]?.access?.[b];
  const bToA = status[b]?.access?.[a];
  if (!aToB || !bToA) return null;
  return weights[bToA] - weights[aToB];
}

function pairMetrics(a, b, status, weights) {
  const aToB = status[a]?.access?.[b];
  const bToA = status[b]?.access?.[a];
  if (!aToB || !bToA) return null;
  return {
    code: b,
    score: weights[bToA] - weights[aToB],
    aToB,
    bToA,
  };
}

function countryName(code, countries) {
  return countries[code]?.country || code;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getScoreWeightsFromModels(scoreModels) {
  const defaultModel = scoreModels?.defaultModel;
  const weights = scoreModels?.models?.[defaultModel]?.weights;
  return weights || DEFAULT_STATUS_WEIGHT;
}

function formatScore(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatAverage(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function scoreClass(score) {
  if (score < 0) return 'score-neg';
  if (score > 0) return 'score-pos';
  return 'score-zero';
}

function statusLabel(lang, status) {
  return I18N[lang].status[status] || status;
}

function historyPath(path) {
  if (!path) return path;
  return path.startsWith('/') ? `.${path}` : path;
}

async function fetchMaybeGzipJson(path) {
  const normalizedPath = historyPath(path);
  const res = await fetch(normalizedPath);
  if (!res.ok) throw new Error(`${normalizedPath}: ${res.status}`);
  if (!normalizedPath.endsWith('.gz')) return await res.json();
  if (!('DecompressionStream' in window)) throw new Error('DecompressionStream unavailable');
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

function computeGlobalScores(origins, status, weights) {
  const rows = [];
  for (const base of origins) {
    let totalScore = 0;
    let validPairs = 0;
    let negative = 0;
    let positive = 0;
    let zero = 0;
    for (const target of origins) {
      if (base === target) continue;
      const score = pairScore(base, target, status, weights);
      if (score === null) continue;
      totalScore += score;
      validPairs++;
      if (score < 0) negative++;
      else if (score > 0) positive++;
      else zero++;
    }
    if (validPairs > 0) {
      rows.push({ code: base, score: totalScore, avg: totalScore / validPairs, validPairs, negative, positive, zero });
    }
  }
  rows.sort((a, b) => a.score - b.score || a.code.localeCompare(b.code));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function badgeForGlobal(row, allRows, lang) {
  const topStart = Math.max(0, allRows.length - 5);
  if (row.rank <= 5) return { text: t(lang, 'badgeUnreciprocal'), cls: 'badge-unreciprocal' };
  if (row.rank > topStart) return { text: t(lang, 'badgeEgoist'), cls: 'badge-egoist' };
  if (row.score === 0) return { text: t(lang, 'badgeReciprocal'), cls: 'badge-reciprocal' };
  if (row.score > 0) return { text: t(lang, 'badgePositive'), cls: 'badge-positive' };
  if (row.score < 0) return { text: t(lang, 'badgeNegative'), cls: 'badge-negative' };
  return { text: t(lang, 'badgeNeutral'), cls: 'badge-neutral' };
}

function renderBadge(badge) {
  return `<span class="badge ${badge.cls}">${esc(badge.text)}</span>`;
}

function renderScoreBars(rows, countries, lang, valueKey = 'avg') {
  if (!rows.length) return `<p class="muted">${t(lang, 'noResults')}</p>`;
  const values = rows.map(row => Math.abs(row[valueKey] || 0));
  const max = Math.max(1, ...values);
  return `
    <div class="chart">
      ${rows.map(row => {
        const value = row[valueKey] || 0;
        const width = Math.max(2, Math.round((Math.abs(value) / max) * 100));
        const cls = value < 0 ? 'neg' : value > 0 ? 'pos' : 'zero';
        return `
          <div class="bar-row">
            <div><strong>${esc(countryName(row.code, countries))}</strong> <span class="muted">(${esc(row.code)})</span></div>
            <div class="bar-track"><div class="bar ${cls}" style="width:${width}%"></div></div>
            <div class="${scoreClass(value)}">${valueKey === 'avg' ? formatAverage(value) : formatScore(value)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPairChart(rows, countries, lang) {
  if (!rows.length) return `<p class="muted">${t(lang, 'noResults')}</p>`;
  const worst = rows.filter(row => row.score < 0).slice(0, 7);
  const best = rows.filter(row => row.score > 0).slice(-7).reverse();
  const selected = [...worst, ...best];
  return renderScoreBars(selected, countries, lang, 'score');
}

function summaryForPairs(rows) {
  const total = rows.reduce((sum, row) => sum + row.score, 0);
  return {
    total,
    avg: rows.length ? total / rows.length : 0,
    negative: rows.filter(row => row.score < 0),
    positive: rows.filter(row => row.score > 0),
    zero: rows.filter(row => row.score === 0),
  };
}

function renderPairList(rows, countries, lang) {
  if (!rows.length) return `<p class="muted">${t(lang, 'noResults')}</p>`;
  return `
    <ul>
      ${rows.slice(0, 6).map(row => `
        <li>
          <strong>${esc(countryName(row.code, countries))}</strong>
          <span class="muted">(${esc(row.code)})</span> —
          <span class="${scoreClass(row.score)}">${formatScore(row.score)}</span>
          <br><span class="muted">${t(lang, 'statusYouToThem')}: ${esc(statusLabel(lang, row.aToB))} / ${t(lang, 'statusThemToYou')}: ${esc(statusLabel(lang, row.bToA))}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

async function main() {
  let lang = setLanguage(detectLanguage());
  const app = document.getElementById('app');
  const title = document.querySelector('title');
  const h1 = document.getElementById('main-title');
  const description = document.getElementById('main-desc');
  const note = document.getElementById('main-note');
  const langButtons = Array.from(document.querySelectorAll('.lang-switch button'));

  let currentCountryCode = null;
  let currentFilterType = 'all';
  let customFilterSelection = [];
  let lastListScrollY = 0;
  let lastCountryCode = null;

  let passportsText, countries, manifest, scoreModels, historyIndex;
  let status = {};
  let origins = [];
  let globalScores = [];
  let scoreWeights = DEFAULT_STATUS_WEIGHT;
  const countryHistory = new Map();

  function syncStaticCopy() {
    title.textContent = t(lang, 'title');
    if (h1) h1.textContent = t(lang, 'title');
    if (description) description.textContent = t(lang, 'description');
    if (note) note.innerHTML = `<strong>${t(lang, 'noteLabel')}</strong> ${t(lang, 'noteText')}`;
    langButtons.forEach(button => {
      const active = button.dataset.lang === lang;
      button.setAttribute('aria-pressed', String(active));
    });
  }

  syncStaticCopy();
  for (const button of langButtons) {
    button.addEventListener('click', () => {
      lang = setLanguage(button.dataset.lang);
      syncStaticCopy();
      if (origins.length > 0) render();
      else app.textContent = t(lang, 'loading');
    });
  }

  try {
    [passportsText, countries, manifest, scoreModels, historyIndex] = await Promise.all([
      fetchText('./data/latest/passports.jsonl'),
      fetchJson('./data/latest/countries.json'),
      fetchJson('./data/latest/manifest.json'),
      fetchJson('./data/latest/score-models.json'),
      fetchJsonOptional('./data/history/index.json'),
    ]);
  } catch (err) {
    app.textContent = t(lang, 'errorPrefix') + err.message;
    return;
  }

  const rows = parseJsonl(passportsText);
  status = buildStatusMap(rows);
  origins = rows.map(row => row.code).sort();
  scoreWeights = getScoreWeightsFromModels(scoreModels);
  globalScores = computeGlobalScores(origins, status, scoreWeights);

  function openCountry(code) {
    if (!origins.includes(code)) return;
    lastListScrollY = window.scrollY;
    lastCountryCode = code;
    currentCountryCode = code;
    currentFilterType = 'all';
    customFilterSelection = [];
    history.pushState({ country: code }, '', `#country=${encodeURIComponent(code)}`);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    ensureCountryHistory(code);
  }

  function closeDetail() {
    const targetCode = lastCountryCode || currentCountryCode;
    currentCountryCode = null;
    history.pushState({}, '', window.location.pathname + window.location.search);
    render();
    requestAnimationFrame(() => {
      const row = targetCode ? document.getElementById(`country-${targetCode}`) : null;
      if (row) row.scrollIntoView({ block: 'center' });
      else window.scrollTo({ top: lastListScrollY, behavior: 'smooth' });
    });
  }

  function routeFromHash() {
    const match = window.location.hash.match(/^#country=([A-Z0-9]{2,3})$/i);
    const code = match ? match[1].toUpperCase() : null;
    currentCountryCode = code && origins.includes(code) ? code : null;
    render();
    if (currentCountryCode) {
      window.scrollTo({ top: 0 });
      ensureCountryHistory(currentCountryCode);
    }
  }

  async function ensureCountryHistory(code) {
    if (countryHistory.has(code)) return;
    countryHistory.set(code, null);
    render();

    try {
      const yearly = historyIndex?.yearly || [];
      if (!yearly.length) {
        countryHistory.set(code, []);
        render();
        return;
      }
      const events = [];
      for (const item of yearly) {
        const pack = await fetchMaybeGzipJson(item.path);
        for (const event of pack.changes || []) {
          if (event.code === code) events.push(event);
        }
      }
      events.sort((a, b) => String(a.changedAt).localeCompare(String(b.changedAt)));
      countryHistory.set(code, events);
    } catch (_err) {
      countryHistory.set(code, 'unsupported');
    }
    render();
  }

  app.addEventListener('click', event => {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === 'country') openCountry(actionTarget.dataset.code);
    if (action === 'back') closeDetail();
  });

  app.addEventListener('change', event => {
    if (event.target.id === 'filterSelect') {
      currentFilterType = event.target.value;
      render();
    }

    if (event.target.id === 'customCountrySelect') {
      customFilterSelection = Array.from(event.target.selectedOptions).map(opt => opt.value);
      render();
    }
  });

  window.addEventListener('popstate', routeFromHash);

  function filteredPairs(base) {
    const scored = [];
    for (const target of origins) {
      if (target === base) continue;
      const row = pairMetrics(base, target, status, scoreWeights);
      if (!row) continue;

      const targetCountry = countries[target];
      const isSchengen = targetCountry && targetCountry.isSchengen;

      if (currentFilterType === 'schengen_only' && !isSchengen) continue;
      if (currentFilterType === 'schengen_except' && isSchengen) continue;
      if (currentFilterType === 'custom_include' && !customFilterSelection.includes(target)) continue;
      if (currentFilterType === 'custom_exclude' && customFilterSelection.length > 0 && customFilterSelection.includes(target)) continue;

      scored.push(row);
    }
    scored.sort((a, b) => a.score - b.score || a.code.localeCompare(b.code));
    return scored;
  }

  function render() {
    if (!currentCountryCode) renderGlobal();
    else renderDetail();
  }

  function renderGlobal() {
    const worstRows = globalScores.slice(0, 12);
    const bestRows = globalScores.slice(-5).reverse();
    const zeroCount = globalScores.filter(row => row.score === 0).length;

    app.innerHTML = `
      <section class="stats">
        <div class="stat-card"><span>${t(lang, 'originCount')}</span><strong>${origins.length}</strong></div>
        <div class="stat-card"><span>${t(lang, 'lastChange')}</span><strong>${esc(manifest.lastSourceDataChangedAt || t(lang, 'missingDate'))}</strong></div>
        <div class="stat-card"><span>${t(lang, 'badgeReciprocal')}</span><strong>${zeroCount}</strong></div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>${t(lang, 'headingGlobal')}</h2>
            <p>${t(lang, 'clickHint')}</p>
          </div>
        </div>
        <h3>${t(lang, 'worstAvgChart')}</h3>
        ${renderScoreBars(worstRows, countries, lang, 'avg')}
      </section>

      <section class="split-grid">
        <div class="split-card">
          <h3>${t(lang, 'badgeUnreciprocal')}</h3>
          ${renderScoreBars(worstRows.slice(0, 5), countries, lang, 'avg')}
        </div>
        <div class="split-card">
          <h3>${t(lang, 'badgeEgoist')}</h3>
          ${renderScoreBars(bestRows, countries, lang, 'avg')}
        </div>
      </section>

      <div class="table-wrap">
        <table>
          <thead><tr><th>${t(lang, 'country')}</th><th>${t(lang, 'badge')}</th><th>${t(lang, 'globalScore')}</th><th>${t(lang, 'averageScore')}</th></tr></thead>
          <tbody>
            ${globalScores.map(row => {
              const badge = badgeForGlobal(row, globalScores, lang);
              return `
                <tr id="country-${esc(row.code)}" class="clickable" data-action="country" data-code="${esc(row.code)}">
                  <td><strong>${esc(countryName(row.code, countries))}</strong> <span class="muted">(${esc(row.code)})</span></td>
                  <td>${renderBadge(badge)}</td>
                  <td class="${scoreClass(row.score)}">${formatScore(row.score)}</td>
                  <td class="${scoreClass(row.avg)}">${formatAverage(row.avg)} <span class="muted">/ ${row.validPairs}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDetail() {
    const base = currentCountryCode;
    const rows = filteredPairs(base);
    const summary = summaryForPairs(rows);
    const showCustomSelect = currentFilterType === 'custom_include' || currentFilterType === 'custom_exclude';
    const historyRows = countryHistory.get(base);

    app.innerHTML = `
      <button class="nav-btn" data-action="back" type="button">${t(lang, 'backBtn')}</button>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>${esc(countryName(base, countries))} — ${t(lang, 'headingDetail')}</h2>
            <p><span class="muted">${esc(base)}</span> · ${rows.length} ${t(lang, 'pairs')}</p>
          </div>
          ${renderBadge(badgeForGlobal(globalScores.find(row => row.code === base), globalScores, lang))}
        </div>
        <div class="stats">
          <div class="stat-card"><span>${t(lang, 'globalScore')}</span><strong class="${scoreClass(summary.total)}">${formatScore(summary.total)}</strong></div>
          <div class="stat-card"><span>${t(lang, 'averageScore')}</span><strong class="${scoreClass(summary.avg)}">${formatAverage(summary.avg)}</strong></div>
          <div class="stat-card"><span>${t(lang, 'summaryNegative')}</span><strong>${summary.negative.length}</strong></div>
          <div class="stat-card"><span>${t(lang, 'summaryZero')}</span><strong>${summary.zero.length}</strong></div>
        </div>
      </section>

      <div class="filter-bar">
        <label for="filterSelect">${t(lang, 'filterLabel')}</label>
        <select id="filterSelect">
          <option value="all" ${currentFilterType === 'all' ? 'selected' : ''}>${t(lang, 'filterAll')}</option>
          <option value="schengen_only" ${currentFilterType === 'schengen_only' ? 'selected' : ''}>${t(lang, 'filterSchengen')}</option>
          <option value="schengen_except" ${currentFilterType === 'schengen_except' ? 'selected' : ''}>${t(lang, 'filterNotSchengen')}</option>
          <option value="custom_include" ${currentFilterType === 'custom_include' ? 'selected' : ''}>${t(lang, 'filterCustomInc')}</option>
          <option value="custom_exclude" ${currentFilterType === 'custom_exclude' ? 'selected' : ''}>${t(lang, 'filterCustomExc')}</option>
        </select>
        ${showCustomSelect ? `
          <div class="filter-custom">
            <label class="muted">${t(lang, 'customSelectHelp')}</label>
            <select id="customCountrySelect" multiple>
              ${origins.filter(code => code !== base).map(code => `
                <option value="${esc(code)}" ${customFilterSelection.includes(code) ? 'selected' : ''}>
                  ${esc(countryName(code, countries))} (${esc(code)})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <section class="split-grid">
        <div class="split-card">
          <h3>${t(lang, 'unfairTitle')}</h3>
          ${renderPairList(summary.negative, countries, lang)}
        </div>
        <div class="split-card">
          <h3>${t(lang, 'strictTitle')}</h3>
          ${renderPairList([...summary.positive].reverse(), countries, lang)}
        </div>
        <div class="split-card">
          <h3>${t(lang, 'reciprocalTitle')}</h3>
          ${renderPairList(summary.zero, countries, lang)}
        </div>
      </section>

      <section class="panel">
        <h3>${t(lang, 'filteredChart')}</h3>
        ${renderPairChart(rows, countries, lang)}
      </section>

      <section class="panel">
        <h3>${t(lang, 'historyTitle')}</h3>
        ${renderHistory(historyRows, base)}
      </section>

      <div class="table-wrap">
        <table>
          <thead><tr><th>${t(lang, 'country')}</th><th>${t(lang, 'score')}</th><th>${t(lang, 'statusYouToThem')}</th><th>${t(lang, 'statusThemToYou')}</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${esc(countryName(row.code, countries))} <span class="muted">(${esc(row.code)})</span></td>
                <td class="${scoreClass(row.score)}">${formatScore(row.score)}</td>
                <td>${esc(statusLabel(lang, row.aToB))}</td>
                <td>${esc(statusLabel(lang, row.bToA))}</td>
              </tr>
            `).join('')}
            ${rows.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:2rem;">${t(lang, 'noResults')}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderHistory(historyRows, code) {
    if (historyRows === null) return `<p class="history-note">${t(lang, 'historyLoading')}</p>`;
    if (historyRows === 'unsupported') return `<p class="history-note">${t(lang, 'historyUnsupported')}</p>`;
    if (!historyRows || historyRows.length === 0) return `<p class="history-note">${t(lang, 'historyEmpty')}</p>`;
    return `
      <div class="chart">
        ${historyRows.map(event => `
          <div class="bar-row">
            <div><strong>${esc(event.changedAt)}</strong></div>
            <div class="bar-track"><div class="bar pos" style="width:100%"></div></div>
            <div class="muted">${esc(code)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  routeFromHash();
}

main().catch(err => {
  console.error(err);
  const app = document.getElementById('app');
  if (!app.textContent.startsWith(t('tr', 'errorPrefix')) && !app.textContent.startsWith(t('en', 'errorPrefix'))) {
    const lang = window.localStorage.getItem('reciprocity-language') === 'en' ? 'en' : 'tr';
    app.textContent = t(lang, 'errorPrefix') + err.message;
  }
});
