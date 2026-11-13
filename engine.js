/* Oak Capital tax fee estimator · shared engine
   Rates come from the Engagement Fee Booklet. Every design uses this file unchanged.
   All fees are ANNUAL (per engagement year). Prices live in CONFIG; questions live in FIELDS.
   "custom" means the item is listed but quoted by a CPA. */
(function (global) {
"use strict";

const CONFIG = {
  bookingUrl: "https://example.com/book",   // replace with your scheduling link
  rangeAllowance: 0,                         // 0 = show one exact fee; e.g. 0.15 shows a range up to 15% higher
  individual: {
    form1040: 1300,       // per Form 1040
    scheduleC: 300,       // per Schedule C
    scheduleE: 300,       // per Schedule E
    stateReturn: 500,     // per state filing
    depreciation: 500     // depreciation maintenance, Form 4562
  },
  business: {
    entities: {           // per return; "custom" = not in the booklet yet, quoted by a CPA
      "S corporation (1120-S)": 2500,
      "Partnership (1065)": "custom",
      "C corporation (1120)": "custom",
      "Other": "custom"
    },
    stateFiling: 500      // per business state filing
  },
  planning: {
    quarterlyProjection: 375,   // per quarterly tax projection
    yearEndReview: 600,
    consultingHour: 225         // "Consulting - CR", priced per hour
  }
};

const SERVICES = [
  { key: "individual", name: "Individual tax return", blurb: "Form 1040, schedules and state returns" },
  { key: "business", name: "Business tax return", blurb: "Entity return and state filings" },
  { key: "planning", name: "Tax planning", blurb: "Projections, year-end review, consulting" }
];

/* Starting state: opens with an example (S-corp owner) so the estimate isn't empty. */
function createState() {
  return {
    selected: new Set(["individual", "business"]),
    individual: { returns: "1", scheduleC: "0", scheduleE: "1", states: "1", depreciation: true },
    business: { entity: "S corporation (1120-S)", returns: "1", states: "1" },
    planning: { quarterly: "4", yearEnd: true, hours: 0 }
  };
}

/* ---------- helpers ---------- */
const money = v => "$" + Math.round(v).toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const txt = (x, s, S) => typeof x === "function" ? x(s, S) : x;
const isC = v => v === "custom";
const opts = o => Object.keys(o);
const n = v => Number(v) || 0;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many || one + "s"}`;
function line(label, amount) { return isC(amount) ? { label, amount: null, custom: true } : { label, amount, custom: false }; }

/* Display periods. Base amounts are annual. */
const PERIOD = {
  year: { k: 1, short: "/yr", long: "per year", label: "Annual" },
  month: { k: 1 / 12, short: "/mo", long: "per month", label: "Monthly" }
};
const amt = (v, p) => v * PERIOD[p || "year"].k;
function totalText(e, p) {
  const lo = money(amt(e.low, p)), hi = money(amt(e.high, p));
  return lo === hi ? lo : `${lo} – ${hi}`;
}

/* ---------- questions (each design renders these its own way) ---------- */
const c = CONFIG;
const FIELDS = {
  individual: [
    { kind: "choice", key: "returns", label: "Form 1040 returns", options: ["1", "2", "3", "4"] },
    { kind: "note", text: () => `${money(c.individual.form1040)} per return. Most households file one.` },
    { kind: "choice", key: "scheduleC", label: "Schedule C (self-employment or sole proprietor income)", options: ["0", "1", "2", "3"] },
    { kind: "choice", key: "scheduleE", label: "Schedule E (rentals, royalties, partnership or S-corp income)", options: ["0", "1", "2", "3", "4"] },
    { kind: "choice", key: "states", label: "State returns", options: ["0", "1", "2", "3", "4"] },
    { kind: "toggle", key: "depreciation", label: () => `Maintain depreciation schedules, Form 4562 (${money(c.individual.depreciation)})` },
    { kind: "note", text: () => `Schedules are ${money(c.individual.scheduleC)} each and state returns ${money(c.individual.stateReturn)} each.` }
  ],
  business: [
    { kind: "choice", key: "entity", label: "Entity type", options: opts(c.business.entities) },
    { kind: "choice", key: "returns", label: "Number of entities", options: ["1", "2", "3", "4"] },
    { kind: "choice", key: "states", label: "Business state filings", options: ["0", "1", "2", "3", "4", "5"] },
    { kind: "note", text: s => isC(c.business.entities[s.entity])
        ? `${s.entity} returns are quoted by your CPA. State filings are ${money(c.business.stateFiling)} each.`
        : `${money(c.business.entities[s.entity])} per return. State filings are ${money(c.business.stateFiling)} each.` }
  ],
  planning: [
    { kind: "choice", key: "quarterly", label: "Quarterly tax projections", options: ["0", "1", "2", "3", "4"] },
    { kind: "toggle", key: "yearEnd", label: () => `Year-end review (${money(c.planning.yearEndReview)})` },
    { kind: "range", key: "hours", label: "Consulting hours", min: 0, max: 40, step: 1, format: v => plural(v, "hour"),
      hint: `${money(c.planning.consultingHour)} per hour. Projections are ${money(c.planning.quarterlyProjection)} each.` }
  ]
};

/* ---------- pricing (annual amounts) ---------- */
function priceIndividual(s) {
  const r = c.individual, L = [];
  L.push(line(`Form 1040 × ${s.returns}`, r.form1040 * n(s.returns)));
  if (n(s.scheduleC)) L.push(line(`Schedule C × ${s.scheduleC}`, r.scheduleC * n(s.scheduleC)));
  if (n(s.scheduleE)) L.push(line(`Schedule E × ${s.scheduleE}`, r.scheduleE * n(s.scheduleE)));
  if (n(s.states)) L.push(line(`State returns × ${s.states}`, r.stateReturn * n(s.states)));
  if (s.depreciation) L.push(line("Depreciation maintenance (Form 4562)", r.depreciation));
  return { lines: L, oneTime: [] };
}
function priceBusiness(s) {
  const per = c.business.entities[s.entity], L = [];
  L.push(line(`${s.entity} × ${s.returns}`, isC(per) ? "custom" : per * n(s.returns)));
  if (n(s.states)) L.push(line(`Business state filings × ${s.states}`, c.business.stateFiling * n(s.states)));
  return { lines: L, oneTime: [] };
}
function pricePlanning(s) {
  const p = c.planning, L = [];
  if (n(s.quarterly)) L.push(line(`Quarterly tax projections × ${s.quarterly}`, p.quarterlyProjection * n(s.quarterly)));
  if (s.yearEnd) L.push(line("Year-end review", p.yearEndReview));
  if (n(s.hours)) L.push(line(`Consulting, ${plural(n(s.hours), "hour")}`, p.consultingHour * n(s.hours)));
  return { lines: L, oneTime: [] };
}
const PRICERS = { individual: priceIndividual, business: priceBusiness, planning: pricePlanning };

/* estimate(S) -> { groups:[{svc, lines, sub, oneTime}], low, high, oneTime:[...], customCount }  (amounts annual) */
function estimate(S) {
  const groups = [], oneTime = [];
  let low = 0, customCount = 0;
  for (const svc of SERVICES) {
    if (!S.selected.has(svc.key)) continue;
    const r = PRICERS[svc.key](S[svc.key]);
    const sub = r.lines.reduce((t, l) => t + (l.amount || 0), 0);
    customCount += r.lines.filter(l => l.custom).length + r.oneTime.filter(o => o.amount == null).length;
    low += sub;
    groups.push({ svc, lines: r.lines, sub, oneTime: r.oneTime });
    for (const o of r.oneTime) oneTime.push({ ...o, svc: svc.name });
  }
  return { groups, low: Math.round(low), high: Math.round(low * (1 + c.rangeAllowance)), oneTime, customCount };
}

/* ---------- shared field rendering + events ---------- */
function renderFields(S, key) {
  const s = S[key];
  return FIELDS[key].filter(f => !f.when || f.when(s, S)).map(f => {
    const label = esc(txt(f.label, s, S) || "");
    switch (f.kind) {
      case "choice":
        return `<div class="q"><span class="lbl">${label}</span><div class="seg" role="group" aria-label="${label}">${f.options.map(o =>
          `<button type="button" data-svc="${key}" data-key="${f.key}" data-val="${esc(o)}" aria-pressed="${s[f.key] === o}">${esc(o)}</button>`).join("")}</div></div>`;
      case "multi":
        return `<div class="q"><span class="lbl">${label}</span><div class="seg" role="group" aria-label="${label}">${f.options.map(o =>
          `<button type="button" data-svc="${key}" data-multi="${f.key}" data-val="${esc(o)}" aria-pressed="${s[f.key].has(o)}">${esc(o)}</button>`).join("")}</div></div>`;
      case "toggle":
        return `<label class="tog"><input type="checkbox" id="${key}-${f.key}" data-svc="${key}" data-key="${f.key}"${s[f.key] ? " checked" : ""}> ${label}</label>`;
      case "range":
        return `<div class="q slider"><label for="${key}-${f.key}">${label}</label><output id="${key}-${f.key}-out">${f.format(s[f.key])}</output>
          <input type="range" id="${key}-${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${s[f.key]}" data-svc="${key}" data-key="${f.key}">
          ${f.hint ? `<span class="hint">${f.hint}</span>` : ""}</div>`;
      case "note":
        return `<p class="hint">${txt(f.text, s, S)}</p>`;
    }
  }).join("");
}

/* Applies a field interaction to state. Returns "full" (re-render), "light" (totals only) or null. */
function handleFieldEvent(S, ev) {
  const t = ev.target;
  if (ev.type === "click") {
    const b = t.closest && t.closest("button[data-svc]");
    if (!b) return null;
    const s = S[b.dataset.svc];
    if (b.dataset.multi) { const set = s[b.dataset.multi]; set.has(b.dataset.val) ? set.delete(b.dataset.val) : set.add(b.dataset.val); }
    else s[b.dataset.key] = b.dataset.val;
    return "full";
  }
  if (ev.type === "change" && t.type === "checkbox" && t.dataset.svc) { S[t.dataset.svc][t.dataset.key] = t.checked; return "full"; }
  if (ev.type === "input" && t.type === "range" && t.dataset.svc) {
    const v = Number(t.value); S[t.dataset.svc][t.dataset.key] = v;
    const f = FIELDS[t.dataset.svc].find(x => x.key === t.dataset.key && x.kind === "range");
    const out = document.getElementById(t.id + "-out"); if (out) out.textContent = f.format(v);
    return "light";
  }
  return null;
}

/* Plain-text summary for copying. */
function summaryText(e, p) {
  p = p || "year";
  return [`Oak Capital estimate: ${totalText(e, p)} ${PERIOD[p].long}`,
    ...e.groups.filter(g => g.lines.length).flatMap(g => [g.svc.name, ...g.lines.map(l => `  ${l.label}: ${l.custom ? "custom quote" : money(amt(l.amount, p))}`)]),
    ...(e.oneTime.length ? ["One-time", ...e.oneTime.map(o => `  ${o.label}: ${o.amount == null ? "custom quote" : money(o.amount)}`)] : [])].join("\n");
}
function copyText(text, btn) {
  const label = btn.textContent;
  const done = m => { btn.textContent = m; setTimeout(() => btn.textContent = label, 1800); };
  try { navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Copy not available here")); }
  catch (_) { done("Copy not available here"); }
}

global.OakEstimator = { CONFIG, SERVICES, FIELDS, PERIOD, createState, money, esc, amt, totalText, estimate, renderFields, handleFieldEvent, summaryText, copyText };
})(window);
