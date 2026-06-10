const STATUS_WEIGHT = {
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
    headingGlobal: 'Küresel Sıralama (Skor ne kadar düşükse o kadar kötü)',
    headingDetail: 'için Mütekabiliyet Detayları',
    country: 'Ülke',
    globalScore: 'Küresel Skor',
    score: 'Skor',
    errorPrefix: 'Hata: ',
    backBtn: '← Küresel Sıralamaya Dön',
    filterLabel: 'Filtre:',
    filterAll: 'Tümü',
    filterSchengen: 'Sadece Schengen',
    filterNotSchengen: 'Schengen Hariç',
    filterCustomInc: 'Özel (Sadece Seçilenler)',
    filterCustomExc: 'Özel (Seçilenler Hariç)',
    customSelectHelp: 'Birden fazla ülke seçmek için Ctrl/Cmd tuşuna basılı tutun.',
    clickHint: '(Detaylar için tıklayın)'
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
    headingGlobal: 'Global Ranking (Lower score is worse)',
    headingDetail: 'Reciprocity Details for',
    country: 'Country',
    globalScore: 'Global Score',
    score: 'Score',
    errorPrefix: 'Error: ',
    backBtn: '← Back to Global Ranking',
    filterLabel: 'Filter:',
    filterAll: 'All',
    filterSchengen: 'Schengen Only',
    filterNotSchengen: 'Except Schengen',
    filterCustomInc: 'Custom (Include Only)',
    filterCustomExc: 'Custom (Exclude)',
    customSelectHelp: 'Hold Ctrl/Cmd to select multiple countries.',
    clickHint: '(Click for details)'
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

function parseJsonl(text) {
  return text.trim().split(/\n+/).filter(Boolean).map(line => JSON.parse(line));
}

function buildStatusMap(rows) {
  const map = {};
  for (const row of rows) map[row.code] = row;
  return map;
}

function pairScore(a, b, status, weights = STATUS_WEIGHT) {
  const aToB = status[a]?.access?.[b];
  const bToA = status[b]?.access?.[a];
  if (!aToB || !bToA) return null;
  return weights[bToA] - weights[aToB];
}

function countryName(code, countries) {
  return countries[code]?.country || code;
}

async function main() {
  let lang = setLanguage(detectLanguage());
  const app = document.getElementById('app');
  const title = document.querySelector('title');
  const h1 = document.getElementById('main-title');
  const description = document.getElementById('main-desc');
  const note = document.getElementById('main-note');
  const langButtons = Array.from(document.querySelectorAll('.lang-switch button'));

  // State
  let currentCountryCode = null;
  let currentFilterType = 'all';
  let customFilterSelection = [];
  
  let passportsText, countries, manifest;
  let status = {};
  let origins = [];
  let globalScores = [];

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

  // Bind language buttons before data fetch to avoid 404 bugs
  syncStaticCopy();
  for (const button of langButtons) {
    button.addEventListener('click', () => {
      lang = setLanguage(button.dataset.lang);
      syncStaticCopy();
      if (origins.length > 0) render(); // re-render if data is loaded
      else app.textContent = t(lang, 'loading');
    });
  }

  try {
    [passportsText, countries, manifest] = await Promise.all([
      fetchText('./data/latest/passports.jsonl'),
      fetchJson('./data/latest/countries.json'),
      fetchJson('./data/latest/manifest.json'),
    ]);
  } catch (err) {
    app.textContent = t(lang, 'errorPrefix') + err.message;
    return; // Stop execution if data fetch fails, but language switcher will still work
  }

  const rows = parseJsonl(passportsText);
  status = buildStatusMap(rows);
  origins = rows.map(r => r.code).sort();

  // Calculate global scores for all countries
  for (const base of origins) {
    let totalScore = 0;
    let validPairs = 0;
    for (const target of origins) {
      if (base === target) continue;
      const score = pairScore(base, target, status);
      if (score !== null) {
        totalScore += score;
        validPairs++;
      }
    }
    if (validPairs > 0) {
      globalScores.push({ code: base, score: totalScore });
    }
  }
  // Sort global scores lowest to highest (most negative first)
  globalScores.sort((a, b) => a.score - b.score || a.code.localeCompare(b.code));

  window.handleCountryClick = function(code) {
    currentCountryCode = code;
    currentFilterType = 'all';
    customFilterSelection = [];
    render();
  };

  window.handleBackClick = function() {
    currentCountryCode = null;
    render();
  };

  window.handleFilterChange = function(e) {
    currentFilterType = e.value;
    render();
  };

  window.handleCustomSelectChange = function(e) {
    const selected = Array.from(e.selectedOptions).map(opt => opt.value);
    customFilterSelection = selected;
    render();
  };

  function render() {
    if (!currentCountryCode) {
      renderGlobal();
    } else {
      renderDetail();
    }
  }

  function renderGlobal() {
    let html = `
      <div class="stats">
        <span>${t(lang, 'originCount')}: <strong>${origins.length}</strong></span>
        <span>${t(lang, 'lastChange')}: <strong>${manifest.lastSourceDataChangedAt || t(lang, 'missingDate')}</strong></span>
      </div>
      <h2>${t(lang, 'headingGlobal')}</h2>
      <p style="font-size: 0.9rem; color: #666;">${t(lang, 'clickHint')}</p>
      <table>
        <thead><tr><th>${t(lang, 'country')}</th><th>${t(lang, 'globalScore')}</th></tr></thead>
        <tbody>
          ${globalScores.map(x => `
            <tr class="clickable" onclick="handleCountryClick('${x.code}')">
              <td><strong>${countryName(x.code, countries)}</strong> <span style="color: #888;">(${x.code})</span></td>
              <td>${x.score > 0 ? '+' + x.score : x.score}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    app.innerHTML = html;
  }

  function renderDetail() {
    const base = currentCountryCode;
    const scored = [];
    
    for (const target of origins) {
      if (target === base) continue;
      const score = pairScore(base, target, status);
      if (score === null) continue;
      
      // Apply filters
      const targetCountry = countries[target];
      const isSchengen = targetCountry && targetCountry.isSchengen;
      
      if (currentFilterType === 'schengen_only' && !isSchengen) continue;
      if (currentFilterType === 'schengen_except' && isSchengen) continue;
      if (currentFilterType === 'custom_include' && customFilterSelection.length > 0 && !customFilterSelection.includes(target)) continue;
      if (currentFilterType === 'custom_exclude' && customFilterSelection.length > 0 && customFilterSelection.includes(target)) continue;

      scored.push({ code: target, score });
    }
    
    // Sort lowest to highest (worst examples for this country first)
    scored.sort((a, b) => a.score - b.score || a.code.localeCompare(b.code));

    const showCustomSelect = (currentFilterType === 'custom_include' || currentFilterType === 'custom_exclude');

    let html = `
      <button class="nav-btn" onclick="handleBackClick()">${t(lang, 'backBtn')}</button>
      
      <h2>${currentCountryCode === 'TR' ? t(lang, 'country') + ' ' : ''}${countryName(base, countries)} ${t(lang, 'headingDetail')}</h2>
      
      <div class="filter-bar">
        <label for="filterSelect">${t(lang, 'filterLabel')}</label>
        <select id="filterSelect" onchange="handleFilterChange(this)">
          <option value="all" ${currentFilterType === 'all' ? 'selected' : ''}>${t(lang, 'filterAll')}</option>
          <option value="schengen_only" ${currentFilterType === 'schengen_only' ? 'selected' : ''}>${t(lang, 'filterSchengen')}</option>
          <option value="schengen_except" ${currentFilterType === 'schengen_except' ? 'selected' : ''}>${t(lang, 'filterNotSchengen')}</option>
          <option value="custom_include" ${currentFilterType === 'custom_include' ? 'selected' : ''}>${t(lang, 'filterCustomInc')}</option>
          <option value="custom_exclude" ${currentFilterType === 'custom_exclude' ? 'selected' : ''}>${t(lang, 'filterCustomExc')}</option>
        </select>
        
        ${showCustomSelect ? `
          <div class="filter-custom">
            <label style="font-size: 0.85rem; color: #555;">${t(lang, 'customSelectHelp')}</label>
            <select multiple onchange="handleCustomSelectChange(this)">
              ${origins.filter(c => c !== base).map(c => `
                <option value="${c}" ${customFilterSelection.includes(c) ? 'selected' : ''}>
                  ${countryName(c, countries)} (${c})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <table>
        <thead><tr><th>${t(lang, 'country')}</th><th>${t(lang, 'score')}</th></tr></thead>
        <tbody>
          ${scored.map(x => `
            <tr>
              <td>${countryName(x.code, countries)} <span style="color: #888;">(${x.code})</span></td>
              <td>${x.score > 0 ? '+' + x.score : x.score}</td>
            </tr>
          `).join('')}
          ${scored.length === 0 ? `<tr><td colspan="2" style="text-align:center; color:#888; padding: 2rem;">Sonuç bulunamadı.</td></tr>` : ''}
        </tbody>
      </table>
    `;
    app.innerHTML = html;
  }

  render();
}

main().catch(err => {
  console.error(err);
  // Unhandled errors that bypass our internal catch block
  if (!document.getElementById('app').textContent.startsWith(t('tr', 'errorPrefix')) && 
      !document.getElementById('app').textContent.startsWith(t('en', 'errorPrefix'))) {
    const lang = window.localStorage.getItem('reciprocity-language') === 'en' ? 'en' : 'tr';
    document.getElementById('app').textContent = t(lang, 'errorPrefix') + err.message;
  }
});
