// data.js - loading, merging and statistics shared by the map and charts pages.
// Data: SEAD-SA (Spatial Economic Activity Data: South Africa), municipal level, tax years 2014-2025.
// Boundaries: Municipal Demarcation Board, 2018 (simplified for the web).

const SEAD = (() => {
  const MEASURES = {
    gini: {
      key: "gini", label: "Gini coefficient", short: "Gini", digits: 3,
      ramp: ["#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#e34a33", "#b30000"],
      fmt: v => v.toFixed(3)
    },
    income: {
      key: "income", label: "Median income (rand)", short: "Median income", digits: 0,
      ramp: ["#edf8e9", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
      fmt: v => "R" + Math.round(v).toLocaleString("en-ZA")
    },
    fte: {
      key: "fte", label: "FTE employees", short: "FTE employees", digits: 0,
      ramp: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],
      fmt: v => Math.round(v).toLocaleString("en-ZA")
    }
  };

  /* ---------- CSV parsing ---------- */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // CSV text -> array of objects keyed by header
  function toObjects(text) {
    const t = parseCSV(text), head = t[0].map(h => h.trim());
    return t.slice(1).map(cells => {
      const o = {};
      head.forEach((h, i) => { o[h] = cells[i]; });
      return o;
    });
  }

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
    return res.text();
  }

  const num = v => (v === undefined || v === "" || v === "NA" || Number.isNaN(Number(v)) ? null : Number(v));

  /* ---------- Load + merge the three measures ---------- */
  // Returns { munis: Map(code -> info), records: [{code, year, fte, income, gini}], years: [..], unallocated: [..] }
  async function load() {
    const [fteTxt, incTxt, giniTxt, geo] = await Promise.all([
      fetchText("data/Municipal_FTE.csv"),
      fetchText("data/Municipal_MedianIncome.csv"),
      fetchText("data/Municipal_Gini.csv"),
      fetch("data/MDB_Local_Municipal_Boundary_2018.geojson").then(r => r.json())
    ]);

    const munis = new Map();
    geo.features.forEach(f => {
        const p = f.properties;
        munis.set(p.CAT_B, { code: p.CAT_B, name: p.MUNICNAME, province: p.PROVINCE, category: p.CAT2 });
    });

    const merged = new Map();          // "CODE|year" -> record
    const unallocated = [];            // jobs the tax data could not place on a municipality
    const get = (code, year) => {
      const k = code + "|" + year;
      if (!merged.has(k)) merged.set(k, { code, year, fte: null, income: null, gini: null });
      return merged.get(k);
    };

    toObjects(fteTxt).forEach(r => {
      const year = Number(r.TaxYear);
      if (!munis.has(r.CAT_B)) { unallocated.push({ label: r.CAT_B, year, fte: num(r.FTE) }); return; }
      get(r.CAT_B, year).fte = num(r.FTE);
    });
    toObjects(incTxt).forEach(r => { if (munis.has(r.CAT_B)) get(r.CAT_B, Number(r.TaxYear)).income = num(r.MedianIncome); });
    toObjects(giniTxt).forEach(r => { if (munis.has(r.CAT_B)) get(r.CAT_B, Number(r.TaxYear)).gini = num(r.gini); });

    const records = [...merged.values()];
    const years = [...new Set(records.map(r => r.year))].sort((a, b) => a - b);
    return { munis, records, years, unallocated };
  }

  /* ---------- Statistics ---------- */
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => (a.length ? sum(a) / a.length : null);
  function median(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  // Class breaks by quantiles (suits skewed data like FTE). Returns k+1 break values.
  function quantileBreaks(values, k) {
    const s = [...values].sort((a, b) => a - b), out = [];
    if (!s.length) return out;
    for (let i = 0; i <= k; i++) {
      const pos = (s.length - 1) * (i / k), lo = Math.floor(pos), hi = Math.ceil(pos);
      out.push(s[lo] + (s[hi] - s[lo]) * (pos - lo));
    }
    return out;
  }
  // Index of the class a value falls in, given breaks from quantileBreaks
  function classOf(v, breaks) {
    for (let i = 1; i < breaks.length - 1; i++) if (v < breaks[i]) return i - 1;
    return breaks.length - 2;
  }
  const pctChange = (from, to) => (from === null || to === null || from === 0 ? null : (to / from - 1) * 100);

  /* ---------- Filtering helpers ---------- */
  function rowsFor(data, year, minFte = 0) {
    return data.records.filter(r => r.year === year && r.fte !== null && r.fte >= minFte);
  }
  function series(data, code, measure) {
    return data.years.map(y => {
      const r = data.records.find(x => x.code === code && x.year === y);
      return r ? r[measure] : null;
    });
  }
  // Rank of a municipality (1 = highest) among the given rows for a measure
  function rankOf(rows, code, measure) {
    const vals = rows.filter(r => r[measure] !== null).sort((a, b) => b[measure] - a[measure]);
    const i = vals.findIndex(r => r.code === code);
    return i < 0 ? null : { rank: i + 1, of: vals.length };
  }

  const PROVINCES = {
    EC: "Eastern Cape", FS: "Free State", GT: "Gauteng", KZN: "KwaZulu-Natal", LIM: "Limpopo",
    MP: "Mpumalanga", NC: "Northern Cape", NW: "North West", WC: "Western Cape"
  };

  return { MEASURES, PROVINCES, parseCSV, toObjects, load, sum, mean, median, quantileBreaks, classOf, pctChange, rowsFor, series, rankOf };
})();

if (typeof module !== "undefined") module.exports = SEAD;
