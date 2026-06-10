const STATUS_WEIGHT = {
  visa_free: 0,
  electronic_travel_authorisation: 1,
  visa_on_arrival: 3,
  visa_online: 4,
  visa_required: 10,
};

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
  const app = document.getElementById('app');
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

  app.innerHTML = `
    <p>Origin sayısı: <code>${origins.length}</code></p>
    <p>Son veri değişimi: <code>${manifest.lastSourceDataChangedAt || 'bilinmiyor'}</code></p>
    <h2>Türkiye için en negatif örnekler</h2>
    <table>
      <thead><tr><th>Ülke</th><th>Skor</th></tr></thead>
      <tbody>
        ${scored.slice(0, 20).map(x => `<tr><td>${countryName(x.code, countries)} (${x.code})</td><td>${x.score}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

main().catch(err => {
  document.getElementById('app').textContent = 'Hata: ' + err.message;
});
