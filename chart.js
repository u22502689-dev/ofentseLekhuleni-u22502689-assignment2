// chart.js - comparison chart page (Chart.js). Needs data.js loaded first.

const $ = id => document.getElementById(id);
const M = SEAD.MEASURES;

const COL_A = "#0f766e", COL_B = "#d97706", COL_REST = "#94a3b8", COL_MED = "#475569";
const state = { a: "CPT", b: "JHB", measure: "gini", year: null, minFte: 0 };
const charts = {};
let data;

function readParams() {
  const p = new URLSearchParams(location.search);
  if (p.get("a")) state.a = p.get("a");
  if (p.get("b")) state.b = p.get("b");
  if (M[p.get("m")]) state.measure = p.get("m");
  if (p.get("year")) state.year = Number(p.get("year"));
}

async function init() {
  try {
    readParams();
    data = await SEAD.load();
    if (!data.munis.has(state.a)) state.a = "CPT";
    if (!data.munis.has(state.b) || state.b === state.a) state.b = state.a === "JHB" ? "CPT" : "JHB";
    if (!state.year || !data.years.includes(state.year)) state.year = data.years[data.years.length - 1];
    buildControls();
    wireEvents();
    update();
  } catch (err) {
    $("status").textContent = "Error: " + err.message + ". Serve the folder over HTTP (python -m http.server) or use GitHub Pages; opening the file directly blocks data loading.";
    $("status").className = "status error";
    console.error(err);
  }
}

function buildControls() {
  const list = [...data.munis.values()].sort((a, b) => a.name.localeCompare(b.name));
  const opts = list.map(m => `<option value="${m.code}">${m.name} (${m.province})</option>`).join("");
  $("muniA").innerHTML = opts; $("muniB").innerHTML = opts;
  $("muniA").value = state.a; $("muniB").value = state.b;
  $("measure").value = state.measure;
  $("year").innerHTML = [...data.years].reverse().map(y => `<option value="${y}">${y}</option>`).join("");
  $("year").value = state.year;
}

function wireEvents() {
  $("muniA").addEventListener("change", e => { state.a = e.target.value; update(); });
  $("muniB").addEventListener("change", e => { state.b = e.target.value; update(); });
  $("measure").addEventListener("change", e => { state.measure = e.target.value; update(); });
  $("year").addEventListener("change", e => { state.year = Number(e.target.value); update(); });
  $("minFte").addEventListener("change", e => { state.minFte = Number(e.target.value); update(); });
}

const nameOf = code => data.munis.get(code).name;

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } }
};

/* ---------- Summary indicators ---------- */
function renderKPIs(rows) {
  const m = M[state.measure];
  const fte = rows.map(r => r.fte);
  const inc = rows.filter(r => r.income !== null).map(r => r.income);
  const gin = rows.filter(r => r.gini !== null).map(r => r.gini);
  const n = ` (${rows.length} municipalities)`;

  $("k1Value").textContent = Math.round(SEAD.sum(fte)).toLocaleString("en-ZA");
  $("k1Note").textContent = `Tax year ${state.year}${n}`;
  $("k2Value").textContent = inc.length ? M.income.fmt(SEAD.median(inc)) : "n/a";
  $("k2Note").textContent = `Tax year ${state.year}`;
  $("k3Value").textContent = gin.length ? SEAD.mean(gin).toFixed(3) : "n/a";
  $("k3Note").textContent = "Simple average across municipalities";

  const first = data.years[0];
  const recFirst = data.records.find(r => r.code === state.a && r.year === first);
  const recNow = data.records.find(r => r.code === state.a && r.year === state.year);
  const change = recFirst && recNow ? SEAD.pctChange(recFirst[state.measure], recNow[state.measure]) : null;
  $("k4Label").textContent = `${m.short}: change since ${first}`;
  $("k4Value").textContent = change === null ? "n/a" : (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
  $("k4Note").textContent = `${nameOf(state.a)}, ${first} to ${state.year}`;
}

/* ---------- Line chart: measure over time, A vs B vs national median ---------- */
function renderLine() {
  const m = M[state.measure];
  const medianSeries = data.years.map(y => {
    const vals = SEAD.rowsFor(data, y, 0).filter(r => r[state.measure] !== null).map(r => r[state.measure]);
    return SEAD.median(vals);
  });
  $("lineTitle").textContent = `${m.label} over time`;
  makeChart("lineChart", {
    type: "line",
    data: {
      labels: data.years,
      datasets: [
        { label: nameOf(state.a), data: SEAD.series(data, state.a, state.measure), borderColor: COL_A, backgroundColor: COL_A, tension: 0.2, pointRadius: 3 },
        { label: nameOf(state.b), data: SEAD.series(data, state.b, state.measure), borderColor: COL_B, backgroundColor: COL_B, tension: 0.2, pointRadius: 3 },
        { label: "Median of all municipalities", data: medianSeries, borderColor: COL_MED, backgroundColor: COL_MED, borderDash: [6, 4], pointRadius: 0, tension: 0.2 }
      ]
    },
    options: Object.assign({}, baseOptions, {
      interaction: { mode: "index", intersect: false },
      scales: { x: { title: { display: true, text: "Tax year" } }, y: { title: { display: true, text: m.label } } },
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y === null ? "n/a" : m.fmt(c.parsed.y)}` } } }
    })
  });
}

/* ---------- Bar chart: top 10 for the year, with the two regions highlighted ---------- */
function renderBar(rows) {
  const m = M[state.measure], key = state.measure;
  const ranked = rows.filter(r => r[key] !== null).sort((x, y) => y[key] - x[key]);
  let shown = ranked.slice(0, 10);
  [state.a, state.b].forEach(code => {
    if (!shown.some(r => r.code === code)) { const r = ranked.find(x => x.code === code); if (r) shown = shown.concat(r); }
  });
  const labels = shown.map(r => `${ranked.indexOf(r) + 1}. ${nameOf(r.code)}`);
  const colours = shown.map(r => (r.code === state.a ? COL_A : r.code === state.b ? COL_B : COL_REST));
  $("barTitle").textContent = `${m.short}: top 10, ${state.year}`;
  makeChart("barChart", {
    type: "bar",
    data: { labels, datasets: [{ label: m.label, data: shown.map(r => r[key]), backgroundColor: colours }] },
    options: Object.assign({}, baseOptions, {
      indexAxis: "y",
      scales: { x: { title: { display: true, text: m.label } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => m.fmt(c.parsed.x) } } }
    })
  });
}

/* ---------- Bubble chart: income vs Gini, bubble size = FTE ---------- */
function renderScatter(rows) {
  const pts = code => rows.filter(r => r.income !== null && r.gini !== null && (code ? r.code === code : r.code !== state.a && r.code !== state.b))
    .map(r => ({ x: r.income, y: r.gini, r: 3 + Math.sqrt(r.fte) / 130, name: nameOf(r.code), fte: r.fte }));
  $("scatterTitle").textContent = `Median income vs Gini coefficient, ${state.year}`;
  makeChart("scatterChart", {
    type: "bubble",
    data: {
      datasets: [
        { label: "Other municipalities", data: pts(null), backgroundColor: "rgba(148,163,184,0.45)", borderColor: "rgba(100,116,139,0.6)" },
        { label: nameOf(state.a), data: pts(state.a), backgroundColor: COL_A, borderColor: "#064e48" },
        { label: nameOf(state.b), data: pts(state.b), backgroundColor: COL_B, borderColor: "#92400e" }
      ]
    },
    options: Object.assign({}, baseOptions, {
      scales: {
        x: { title: { display: true, text: "Median income (rand)" } },
        y: { title: { display: true, text: "Gini coefficient" } }
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: c => `${c.raw.name}: income ${M.income.fmt(c.raw.x)}, Gini ${c.raw.y.toFixed(3)}, ${Math.round(c.raw.fte).toLocaleString("en-ZA")} FTE` } }
      }
    })
  });
}

function update() {
  const rows = SEAD.rowsFor(data, state.year, state.minFte);
  $("status").textContent = `${nameOf(state.a)} compared with ${nameOf(state.b)}. Bar chart, scatterplot and indicators use ${rows.length} municipalities for ${state.year}.`;
  $("status").className = "status";
  renderKPIs(rows);
  renderLine();
  renderBar(rows);
  renderScatter(rows);
    if (typeof refreshMapStyle === "function") refreshMapStyle();
}

window.addEventListener("DOMContentLoaded", init);
