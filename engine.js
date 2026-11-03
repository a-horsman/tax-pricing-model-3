/* Oak Capital fee estimator · shared engine
   Every design uses this file unchanged. Prices live in CONFIG; questions live in FIELDS.
   Tax and advisory amounts are ANNUAL. Bookkeeping, operations and CFO are MONTHLY.
   "custom" means the item is listed but quoted by a CPA. */
const CONFIG = {
  bookingUrl: "https://example.com/book",   // replace with your scheduling link
  rangeAllowance: 0.15,
  tax: {
    filing: { "Single": 1800, "Married filing jointly": 1800, "Head of household": 1800, "Married filing separately": 1950 },
    selfEmployed: { "No": 0, "Me or spouse": 600, "Both of us": 1200 },
    rentals: { "0": 0, "1": 500, "2": 900, "3": 1300, "4+": "custom" },
    k1s: { "0": 0, "1–3": 300, "4–10": 750, "11+": "custom" },
    states: { "1": 0, "2–3": 350, "4–6": 900, "7+": "custom" },
    equityCrypto: 400,
    entity: { "Sole prop / single-member LLC": 1800, "S corporation": 3000, "Partnership / multi-member LLC": 3000, "C corporation": 3600, "Nonprofit": 2800 },
    revenue: { "Under $500k": 0, "$500k–$2M": 900, "$2M–$10M": 2400, "$10M+": "custom" },
    owners: { "1": 0, "2–5": 450, "6–15": 1200, "16+": "custom" },
    bundleDiscount: 0.10
  },
  advisory: {
    retainer: 2400, perStrategy: 900,
    standard: ["S-corp election & reasonable comp", "Accountable plan", "Home office", "Augusta rule", "Retirement plan design", "Quarterly estimate management"],
    complex: ["Cost segregation", "R&D tax credit", "Captive insurance", "Oil & gas investment", "Entity restructuring"],
    assessment: 2500
  },
  bookkeeping: {
    // [revenue from, revenue to, monthly fee at "from", monthly fee at "to"], interpolated inside each band
    bands: [[0,250e3,450,600],[250e3,500e3,600,850],[500e3,1e6,850,1200],[1e6,2.5e6,1200,1900],[2.5e6,5e6,1900,2900],[5e6,10e6,2900,4500]],
    accrual: 1.25,
    frequency: { "Weekly": 1.5, "Monthly": 1, "Quarterly": 0.8 },
    accounts: { "1–5": 0, "6–10": 100, "11–20": 250, "21+": "custom" },
    catchup: { "Current": 0, "1–3 months": 750, "4–6 months": 1500, "7–12 months": 3000, "12+ months": "custom" }
  },
  operations: {
    payrollBase: 150, perEmployee: 8, maxEmployees: 100,
    billPay: { "Up to 25": 150, "26–75": 300, "76–150": 550, "150+": "custom" },
    invoicing: 350, salesTax: 250, inventory: 200, integrations: 150
  },
  cfo: {
    tiers: {
      Essentials: { price: 2500, items: ["Monthly financial package", "KPI dashboard", "Quarterly review call"] },
      Growth: { price: 4500, items: ["Everything in Essentials", "Annual budget & variance", "13-week cash forecast", "Monthly strategy meeting"] },
      Strategic: { price: 7500, items: ["Everything in Growth", "Driver-based financial model", "Board & investor reporting", "Financing / fundraising support"] }
    },
    assessment: 3000
  },
  valuation: {
    goals: {
      "Curious what it's worth": "Indication of value",
      "Selling in 1–5 years": "Indication of value",
      "Selling within 12 months": "Calculation report",
      "Buying out a partner": "Calculation report",
      "Gifting or estate planning": "Conclusion of value"
    },
    levels: {
      "Indication of value": { price: 3500, note: "Range of value, 2–3 weeks" },
      "Calculation report": { price: 6500, note: "Multiple methods, written report" },
      "Conclusion of value": { price: 12000, note: "Full appraisal, IRS-compliant (from)" }
    }
  }
};

const SERVICES = [
  { key: "tax", name: "Tax preparation", blurb: "Individual and business returns" },
  { key: "advisory", name: "Tax planning", blurb: "Year-round strategy retainer" },
  { key: "bookkeeping", name: "Bookkeeping", blurb: "Monthly close and reconciliations" },
  { key: "operations", name: "Payroll & payables", blurb: "Payroll, bill pay, invoicing" },
  { key: "cfo", name: "Fractional CFO", blurb: "Forecasting, reporting, strategy" },
  { key: "valuation", name: "Business valuation", blurb: "One-time valuation report" }
];

/* Starting state: opens with an example so the estimate isn't empty. */
function createState() {
  return {
    selected: new Set(["tax", "bookkeeping"]),
    tax: { type: "Business", filing: "Married filing jointly", selfEmployed: "No", rentals: "0", k1s: "1–3", states: "1", equityCrypto: false,
           entity: "S corporation", revenue: "$500k–$2M", owners: "2–5" },
    advisory: { strategies: new Set(["S-corp election & reasonable comp"]), assessment: false },
    bookkeeping: { revenue: 1200000, basis: "Cash", frequency: "Monthly", accounts: "6–10", catchup: "Current" },
    operations: { payroll: true, employees: 12, billPay: false, bills: "Up to 25", invoicing: false, salesTax: false, inventory: false, integrations: false },
    cfo: { tier: "Growth", assessment: false },
    valuation: { goal: "Curious what it's worth" }
  };
}

/* ---------- helpers ---------- */
const money = v => "$" + Math.round(v).toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const txt = (x, s, S) => typeof x === "function" ? x(s, S) : x;
const isC = v => v === "custom";
const r10 = v => Math.round(v / 10) * 10;
const yr = v => isC(v) ? v : v / 12;
const opts = o => Object.keys(o);
function line(label, monthly) { return isC(monthly) ? { label, monthly: null, custom: true } : { label, monthly, custom: false }; }

/* ---------- questions (each design renders these its own way) ---------- */
const ind = s => s.type !== "Business", bus = s => s.type !== "Individual";
const FIELDS = {
  tax: [
    { kind: "choice", key: "type", label: "Which returns do you need?", options: ["Individual", "Business", "Both"] },
    { kind: "choice", key: "filing", label: "Filing status", options: opts(CONFIG.tax.filing), when: ind },
    { kind: "choice", key: "selfEmployed", label: "1099 / self-employment income", options: opts(CONFIG.tax.selfEmployed), when: ind },
    { kind: "choice", key: "rentals", label: "Rental properties", options: opts(CONFIG.tax.rentals), when: ind },
    { kind: "choice", key: "k1s", label: "K-1s you receive", options: opts(CONFIG.tax.k1s), when: ind },
    { kind: "choice", key: "states", label: "States you file in", options: opts(CONFIG.tax.states), when: ind },
    { kind: "toggle", key: "equityCrypto", label: "Stock options, RSUs or crypto activity", when: ind },
    { kind: "choice", key: "entity", label: "Entity type", options: opts(CONFIG.tax.entity), when: bus },
    { kind: "choice", key: "revenue", label: "Gross revenue last year", options: opts(CONFIG.tax.revenue), when: bus },
    { kind: "choice", key: "owners", label: "Owners, partners or shareholders", options: opts(CONFIG.tax.owners), when: bus },
    { kind: "note", when: s => s.type === "Both", text: () => `Filing both with us takes ${CONFIG.tax.bundleDiscount * 100}% off the individual return.` }
  ],
  advisory: [
    { kind: "note", text: () => `Base retainer ${money(CONFIG.advisory.retainer)}/yr covers a year-end projection and two planning meetings. Each added strategy is ${money(CONFIG.advisory.perStrategy)}/yr.` },
    { kind: "multi", key: "strategies", label: "Strategies to implement", options: CONFIG.advisory.standard },
    { kind: "multi", key: "strategies", label: "Complex strategies, scoped individually", options: CONFIG.advisory.complex },
    { kind: "toggle", key: "assessment", label: () => `Add a strategic tax assessment (${money(CONFIG.advisory.assessment)} one-time)` }
  ],
  bookkeeping: [
    { kind: "range", key: "revenue", label: "Annual revenue", min: 50000, max: 12000000, step: 25000, format: money, hint: "Above $10M we scope bookkeeping individually." },
    { kind: "choice", key: "basis", label: "Accounting basis", options: ["Cash", "Accrual"] },
    { kind: "choice", key: "frequency", label: "How often books are closed", options: opts(CONFIG.bookkeeping.frequency) },
    { kind: "choice", key: "accounts", label: "Bank, card and loan accounts", options: opts(CONFIG.bookkeeping.accounts) },
    { kind: "choice", key: "catchup", label: "How far behind are the books?", options: opts(CONFIG.bookkeeping.catchup) }
  ],
  operations: [
    { kind: "toggle", key: "payroll", label: "Payroll" },
    { kind: "range", key: "employees", label: "Employees on payroll", min: 1, max: 150, step: 1, format: String, when: s => s.payroll,
      hint: `${money(CONFIG.operations.payrollBase)}/mo plus ${money(CONFIG.operations.perEmployee)} per employee. Over ${CONFIG.operations.maxEmployees} is scoped individually.` },
    { kind: "toggle", key: "billPay", label: "Bill pay" },
    { kind: "choice", key: "bills", label: "Bills paid per month", options: opts(CONFIG.operations.billPay), when: s => s.billPay },
    { kind: "toggle", key: "invoicing", label: `Invoicing & collections (${money(CONFIG.operations.invoicing)}/mo)` },
    { kind: "toggle", key: "salesTax", label: `Sales tax filings (${money(CONFIG.operations.salesTax)}/mo)` },
    { kind: "toggle", key: "inventory", label: `Inventory tracking (${money(CONFIG.operations.inventory)}/mo)` },
    { kind: "toggle", key: "integrations", label: `Integrations such as Stripe, Shopify, Square (${money(CONFIG.operations.integrations)}/mo)` }
  ],
  cfo: [
    { kind: "tiers", key: "tier", label: "Choose a level of support" },
    { kind: "toggle", key: "assessment", label: () => `Start with a finance function assessment (${money(CONFIG.cfo.assessment)} one-time)` },
    { kind: "note", when: (s, S) => !S.selected.has("bookkeeping"), text: () => "CFO work relies on accurate monthly books. Add bookkeeping if yours aren't closed by a professional." }
  ],
  valuation: [
    { kind: "choice", key: "goal", label: "What's driving the valuation?", options: opts(CONFIG.valuation.goals) },
    { kind: "note", text: s => { const l = CONFIG.valuation.goals[s.goal], p = CONFIG.valuation.levels[l]; return `Recommended: <b>${l}</b>, ${money(p.price)} one-time. ${p.note}.`; } }
  ]
};

/* ---------- pricing ---------- */
function priceTax(t) {
  const c = CONFIG.tax, L = [], i = ind(t), b = bus(t);
  if (i) {
    L.push(line(`Individual return (${t.filing})`, yr(c.filing[t.filing])));
    if (c.selfEmployed[t.selfEmployed]) L.push(line("Self-employment income", yr(c.selfEmployed[t.selfEmployed])));
    if (t.rentals !== "0") L.push(line(`Rental properties (${t.rentals})`, yr(c.rentals[t.rentals])));
    if (t.k1s !== "0") L.push(line(`K-1s received (${t.k1s})`, yr(c.k1s[t.k1s])));
    if (t.states !== "1") L.push(line(`State returns (${t.states})`, yr(c.states[t.states])));
    if (t.equityCrypto) L.push(line("Equity comp / crypto", yr(c.equityCrypto)));
  }
  if (b) {
    L.push(line(`Business return (${t.entity})`, yr(c.entity[t.entity])));
    if (c.revenue[t.revenue]) L.push(line(`Revenue ${t.revenue}`, yr(c.revenue[t.revenue])));
    if (t.owners !== "1") L.push(line(`Owners (${t.owners})`, yr(c.owners[t.owners])));
  }
  if (i && b) L.push({ label: `Bundle discount (${c.bundleDiscount * 100}% off individual)`, monthly: -yr(c.filing[t.filing]) * c.bundleDiscount, custom: false });
  return { lines: L, oneTime: [] };
}
function priceAdvisory(a) {
  const c = CONFIG.advisory, L = [line("Planning retainer", yr(c.retainer))];
  for (const s of a.strategies) L.push(line(s, c.complex.includes(s) ? "custom" : yr(c.perStrategy)));
  return { lines: L, oneTime: a.assessment ? [{ label: "Strategic tax assessment", amount: c.assessment }] : [] };
}
function bookkeepingBase(rev) {
  const band = CONFIG.bookkeeping.bands.find(b => rev >= b[0] && rev <= b[1]);
  if (!band) return "custom";
  const [a, b, lo, hi] = band;
  return lo + (rev - a) / (b - a) * (hi - lo);
}
function priceBookkeeping(k) {
  const c = CONFIG.bookkeeping, L = [], base = bookkeepingBase(k.revenue);
  if (isC(base)) L.push(line(`Books for ${money(k.revenue)} revenue`, "custom"));
  else L.push(line(`Books for ${money(k.revenue)} revenue, ${k.basis.toLowerCase()}, ${k.frequency.toLowerCase()}`,
    r10(base * (k.basis === "Accrual" ? c.accrual : 1) * c.frequency[k.frequency])));
  if (c.accounts[k.accounts]) L.push(line(`Connected accounts (${k.accounts})`, c.accounts[k.accounts]));
  const cu = c.catchup[k.catchup];
  return { lines: L, oneTime: k.catchup === "Current" ? [] : [{ label: `Catch-up bookkeeping (${k.catchup})`, amount: isC(cu) ? null : cu }] };
}
function priceOperations(o) {
  const c = CONFIG.operations, L = [];
  if (o.payroll) L.push(line(`Payroll (${o.employees} employees)`, o.employees > c.maxEmployees ? "custom" : c.payrollBase + c.perEmployee * o.employees));
  if (o.billPay) L.push(line(`Bill pay (${o.bills} bills/mo)`, c.billPay[o.bills]));
  if (o.invoicing) L.push(line("Invoicing & collections", c.invoicing));
  if (o.salesTax) L.push(line("Sales tax filings", c.salesTax));
  if (o.inventory) L.push(line("Inventory tracking", c.inventory));
  if (o.integrations) L.push(line("App integrations", c.integrations));
  return { lines: L, oneTime: [] };
}
function priceCfo(f) {
  const c = CONFIG.cfo;
  return { lines: [line(`${f.tier} tier`, c.tiers[f.tier].price)], oneTime: f.assessment ? [{ label: "Finance function assessment", amount: c.assessment }] : [] };
}
function priceValuation(v) {
  const lvl = CONFIG.valuation.goals[v.goal];
  return { lines: [], oneTime: [{ label: `Valuation: ${lvl}`, amount: CONFIG.valuation.levels[lvl].price }] };
}
const PRICERS = { tax: priceTax, advisory: priceAdvisory, bookkeeping: priceBookkeeping, operations: priceOperations, cfo: priceCfo, valuation: priceValuation };

/* estimate(S) -> { groups:[{svc, lines, sub, oneTime}], low, high, oneTime:[...], customCount }  (amounts monthly) */
function estimate(S) {
  const groups = [], oneTime = [];
  let low = 0, customCount = 0;
  for (const svc of SERVICES) {
    if (!S.selected.has(svc.key)) continue;
    const r = PRICERS[svc.key](S[svc.key]);
    const sub = r.lines.reduce((t, l) => t + (l.monthly || 0), 0);
    customCount += r.lines.filter(l => l.custom).length + r.oneTime.filter(o => o.amount == null).length;
    low += sub;
    groups.push({ svc, lines: r.lines, sub, oneTime: r.oneTime });
    for (const o of r.oneTime) oneTime.push({ ...o, svc: svc.name });
  }
  return { groups, low: Math.round(low), high: Math.round(low * (1 + CONFIG.rangeAllowance)), oneTime, customCount };
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
      case "tiers":
        return `<div class="q"><span class="lbl">${label}</span><div class="tiers">${Object.entries(CONFIG.cfo.tiers).map(([n, t]) =>
          `<button type="button" class="tier" data-svc="${key}" data-key="${f.key}" data-val="${n}" aria-pressed="${s[f.key] === n}">
            <b>${n}</b><span class="p">${money(t.price)}/mo</span><ul>${t.items.map(i => `<li>${i}</li>`).join("")}</ul></button>`).join("")}</div></div>`;
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

/* Plain-text summary for copying. period: "month" | "year" */
function summaryText(e, period) {
  const k = period === "year" ? 12 : 1, sfx = period === "year" ? "/yr" : "/mo";
  return [`Oak Capital estimate: ${money(e.low * k)} – ${money(e.high * k)} ${sfx}`,
    ...e.groups.filter(g => g.lines.length).flatMap(g => [g.svc.name, ...g.lines.map(l => `  ${l.label}: ${l.custom ? "custom quote" : money(l.monthly * k)}`)]),
    ...(e.oneTime.length ? ["One-time", ...e.oneTime.map(o => `  ${o.label}: ${o.amount == null ? "custom quote" : money(o.amount)}`)] : [])].join("\n");
}
function copyText(text, btn) {
  const label = btn.textContent;
  const done = m => { btn.textContent = m; setTimeout(() => btn.textContent = label, 1800); };
  try { navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Copy not available here")); }
  catch (_) { done("Copy not available here"); }
}
