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
    originCount: 'Origin sayısı',
    lastChange: 'Son veri değişimi',
    missingDate: 'bilinmiyor',
    heading: 'Türkiye için en negatif örnekler',
    country: 'Ülke',
    score: 'Skor',
    errorPrefix: 'Hata: ',
  },
  en: {
    title: 'Reciprocity Index',
    description: 'If a country requires a visa from you, do you also require a visa from it?',
    noteLabel: 'Note:',
    noteText: 'In a heavier tone, you could also call this the “Capitulation Index.”',
    loading: 'Loading...',
    originCount: 'Origin count',
    lastChange: 'Last data change',
    missingDate: 'unknown',
    heading: 'Most negative examples for Turkey',
    country: 'Country',
    score: 'Score',
    errorPrefix: 'Error: ',
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
  const h1 = document.querySelector('h1');
  const description = document.querySelector('body > p');
  const note = document.querySelector('body > p + p');
  const langButtons = Array.from(document.querySelectorAll('.lang-switch button'));

  function syncStaticCopy() {
    title.textContent = t(lang, 'title');
    h1.textContent = t(lang, 'title');
    description.textContent = t(lang, 'description');
    note.innerHTML = `<strong>${t(lang, 'noteLabel')}</strong> ${t(lang, 'noteText')}`;
    langButtons.forEach(button => {
      const active = button.dataset.lang === lang;
      button.setAttribute('aria-pressed', String(active));
    });
  }

  const [passportsText, countries, manifest] = await Promise.all([
    fetchText('./data/latest/passports.jsonl'),
    fetchJson('./data/latest/countries.json'),
    fetchJson('./data/latest/manifest.json'),
  ]);

  const rows = parseJsonl(passportsText);
  const status = buildStatusMap(rows);
  const origins = rows.map(r => r.code).sort();

  const base = 'TR';
  const scored = [];
  for (const target of origins) {
    if (target === base) continue;
    const score = pairScore(base, target, status);
    if (score === null) continue;
    scored.push({ code: target, score });
  }
  scored.sort((a, b) => a.score - b.score || a.code.localeCompare(b.code));

  syncStaticCopy();

  for (const button of langButtons) {
    button.addEventListener('click', () => {
      lang = setLanguage(button.dataset.lang);
      syncStaticCopy();
      render();
    });
  }

  function render() {
    app.innerHTML = `
      <p>${t(lang, 'originCount')}: <code>${origins.length}</code></p>
      <p>${t(lang, 'lastChange')}: <code>${manifest.lastSourceDataChangedAt || t(lang, 'missingDate')}</code></p>
      <h2>${t(lang, 'heading')}</h2>
      <table>
        <thead><tr><th>${t(lang, 'country')}</th><th>${t(lang, 'score')}</th></tr></thead>
        <tbody>
          ${scored.slice(0, 20).map(x => `<tr><td>${countryName(x.code, countries)} (${x.code})</td><td>${x.score}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  render();
}

main().catch(err => {
  const lang = window.localStorage.getItem('reciprocity-language') === 'en' ? 'en' : 'tr';
  document.getElementById('app').textContent = t(lang, 'errorPrefix') + err.message;
});
