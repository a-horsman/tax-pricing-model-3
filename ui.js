/* "Statement" layout: an accordion of services with include switches, followed by a full fee statement table. */
const S = createState();
const open = new Set(["tax"]);
const $ = id => document.getElementById(id);
const fmt = v => (v < 0 ? "−" : "") + money(Math.abs(v));

function subLabel(e, key) {
  const g = e.groups.find(g => g.svc.key === key);
  if (!g) return `<span class="off">Not included</span>`;
  const parts = [];
  if (g.lines.length) parts.push(`${money(g.sub)}<small>/mo</small>`);
  const ot = g.oneTime.reduce((t, o) => t + (o.amount || 0), 0);
  if (ot) parts.push(`${money(ot)}<small> one-time</small>`);
  if (g.lines.some(l => l.custom)) parts.push(`<small class="cq">+ custom quote</small>`);
  return parts.join(" ") || "–";
}

function renderLedger(e) {
  $("ledger").innerHTML = SERVICES.map(s => {
    const on = S.selected.has(s.key), isOpen = on && open.has(s.key);
    return `<article class="acct${on ? " on" : ""}">
      <div class="acct-head">
        <button type="button" class="switch" id="inc-${s.key}" role="switch" aria-checked="${on}" data-pick="${s.key}" aria-label="Include ${s.name}"><span></span></button>
        <button type="button" class="acct-title" id="open-${s.key}" data-open="${s.key}" aria-expanded="${isOpen}" aria-controls="body-${s.key}"${on ? "" : " disabled"}>
          <span class="name">${s.name}</span><span class="blurb">${s.blurb}</span>
        </button>
        <span class="acct-sub" id="sub-${s.key}">${subLabel(e, s.key)}</span>
      </div>
      ${isOpen ? `<div class="acct-body" id="body-${s.key}">${renderFields(S, s.key)}</div>` : ""}
    </article>`;
  }).join("");
}

function renderStatement(e) {
  const recurring = e.groups.filter(g => g.lines.length);
  const rows = recurring.map(g =>
    `<tr class="g"><th scope="rowgroup" colspan="2">${g.svc.name}</th><td class="num">${money(g.sub)}</td><td class="num">${money(g.sub * 12)}</td></tr>` +
    g.lines.map(l => `<tr><td></td><td>${esc(l.label)}</td>${l.custom
      ? `<td class="num cq" colspan="2">Custom quote</td>`
      : `<td class="num">${fmt(l.monthly)}</td><td class="num">${fmt(l.monthly * 12)}</td>`}</tr>`).join("")).join("");
  $("statement").innerHTML = `
    <div class="st-head">
      <div>
        <div class="lbl">Statement of estimated fees</div>
        <div class="total">${recurring.length ? `${money(e.low)} – ${money(e.high)}<small> per month</small>` : `<small>No recurring services</small>`}</div>
        ${recurring.length ? `<div class="annual">${money(e.low * 12)} – ${money(e.high * 12)} per year</div>` : ""}
        ${e.customCount ? `<div class="note">${e.customCount} item${e.customCount > 1 ? "s are" : " is"} quoted separately by your CPA and not in this total.</div>` : ""}
      </div>
      <div class="actions">
        <a class="btn primary" href="${CONFIG.bookingUrl}" target="_blank" rel="noopener">Book a consultation</a>
        <button type="button" class="btn ghost" id="copy">Copy summary</button>
      </div>
    </div>
    ${recurring.length ? `<div class="tablewrap"><table>
      <thead><tr><th scope="col">Service</th><th scope="col">Item</th><th scope="col" class="num">Per month</th><th scope="col" class="num">Per year</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th colspan="2" scope="row">Subtotal</th><td class="num">${money(e.low)}</td><td class="num">${money(e.low * 12)}</td></tr>
        <tr class="allow"><th colspan="2" scope="row">With ${CONFIG.rangeAllowance * 100}% complexity allowance</th><td class="num">${money(e.high)}</td><td class="num">${money(e.high * 12)}</td></tr></tfoot>
    </table></div>` : ""}
    ${e.oneTime.length ? `<div class="onetime"><div class="lbl">One-time fees</div>${e.oneTime.map(o =>
      `<div class="row"><span>${esc(o.label)}</span><span class="${o.amount == null ? "cq" : ""}">${o.amount == null ? "Custom quote" : money(o.amount)}</span></div>`).join("")}</div>` : ""}
    <p class="fine">Assumes clean, current records and a standard scope. Your CPA confirms the final quote on a call.</p>`;
}

function render() { const e = estimate(S); renderLedger(e); renderStatement(e); }
function light() {
  const e = estimate(S);
  SERVICES.forEach(s => { const el = $("sub-" + s.key); if (el) el.innerHTML = subLabel(e, s.key); });
  renderStatement(e);
}

document.addEventListener("click", ev => {
  const t = ev.target.closest("button"); if (!t) return;
  if (t.dataset.pick) {
    const k = t.dataset.pick;
    if (S.selected.has(k)) { S.selected.delete(k); open.delete(k); } else { S.selected.add(k); open.add(k); }
    render(); $("inc-" + k).focus(); return;
  }
  if (t.dataset.open) { const k = t.dataset.open; open.has(k) ? open.delete(k) : open.add(k); render(); $("open-" + k).focus(); return; }
  if (t.id === "copy") { copyText(summaryText(estimate(S), "month"), t); return; }
  if (handleFieldEvent(S, ev)) render();
});
["change", "input"].forEach(type => document.addEventListener(type, ev => {
  const r = handleFieldEvent(S, ev); if (r === "full") render(); else if (r === "light") light();
}));

render();
