/* "Signal" layout: service chips, one tab per selected service, and a fixed price bar with a pull-up breakdown. */
(function () {
"use strict";
const { CONFIG, SERVICES, PERIOD, createState, money, esc, amt, totalText, estimate, renderFields, handleFieldEvent, summaryText, copyText } = window.OakEstimator;

const S = createState();
let active = SERVICES[0].key, period = "year";
const $ = id => document.getElementById(id);


function renderChips() {
  $("chips").innerHTML = SERVICES.map(s =>
    `<button type="button" class="chip" id="chip-${s.key}" data-pick="${s.key}" aria-pressed="${S.selected.has(s.key)}"><span class="tick" aria-hidden="true"></span>${s.name}</button>`).join("");
}

function renderTabs(e) {
  $("tabs").innerHTML = SERVICES.filter(s => S.selected.has(s.key)).map(s => {
    const g = e.groups.find(g => g.svc.key === s.key);
    const sub = g.lines.length ? money(amt(g.sub, period)) : g.oneTime.length ? "One-time" : "";
    return `<button type="button" role="tab" id="tab-${s.key}" data-tab="${s.key}" aria-selected="${s.key === active}"><span>${s.name}</span><small>${sub}</small></button>`;
  }).join("");
}

function renderPanel() {
  const svc = SERVICES.find(s => s.key === active);
  $("tabpanel").innerHTML = svc
    ? `<div class="panel-head"><h2>${svc.name}</h2><p class="sub">${svc.blurb}</p></div><div class="fields">${renderFields(S, active)}</div>`
    : `<div class="empty">Turn on a service above to start your estimate.</div>`;
  if (svc) $("tabpanel").setAttribute("aria-labelledby", "tab-" + svc.key);
}

function renderSummary() {
  const e = estimate(S), sfx = PERIOD[period].short;
  document.querySelectorAll("[data-period]").forEach(b => b.setAttribute("aria-pressed", b.dataset.period === period));
  $("total").innerHTML = e.groups.some(g => g.lines.length) ? `${totalText(e, period)}<small>${sfx}</small>` : `<small>No services selected</small>`;
  $("customNote").hidden = !e.customCount;
  $("customNote").textContent = e.customCount ? `+ ${e.customCount} custom-quoted item${e.customCount > 1 ? "s" : ""}` : "";
  $("lines").innerHTML = e.groups.filter(g => g.lines.length).map(g =>
    `<div class="grp"><h3>${g.svc.name}<span>${money(amt(g.sub, period))}</span></h3>${g.lines.map(l =>
      `<div class="row${l.amount < 0 ? " neg" : ""}"><span>${esc(l.label)}</span><span class="${l.custom ? "cq" : ""}">${l.custom ? "Custom quote" : (l.amount < 0 ? "−" : "") + money(amt(Math.abs(l.amount), period))}</span></div>`).join("")}</div>`).join("")
    || `<p class="fine">No services selected.</p>`;
  const ot = $("onetime");
  ot.hidden = !e.oneTime.length;
  ot.innerHTML = `<div class="lbl">One-time</div>` + e.oneTime.map(o =>
    `<div class="row"><span>${esc(o.label)}</span><span class="${o.amount == null ? "cq" : ""}">${o.amount == null ? "Custom quote" : money(o.amount)}</span></div>`).join("");
  renderTabs(e);
}

function render() {
  if (!S.selected.has(active)) active = (SERVICES.find(s => S.selected.has(s.key)) || {}).key || null;
  renderChips(); renderPanel(); renderSummary();
}

document.addEventListener("click", ev => {
  const t = ev.target.closest("button"); if (!t) return;
  if (t.dataset.pick) {
    const k = t.dataset.pick;
    if (S.selected.has(k)) S.selected.delete(k); else { S.selected.add(k); active = k; }
    render(); return;
  }
  if (t.dataset.tab) { active = t.dataset.tab; render(); return; }
  if (t.dataset.period) { period = t.dataset.period; renderSummary(); return; }
  if (t.id === "toggleDrawer") {
    const open = $("drawer").hidden; $("drawer").hidden = !open;
    t.setAttribute("aria-expanded", open); t.textContent = open ? "Hide breakdown" : "Breakdown"; return;
  }
  if (t.id === "copy") { copyText(summaryText(estimate(S), period), t); return; }
  if (handleFieldEvent(S, ev)) { renderPanel(); renderSummary(); }
});
["change", "input"].forEach(type => document.addEventListener(type, ev => {
  const r = handleFieldEvent(S, ev); if (r === "full") { renderPanel(); renderSummary(); } else if (r === "light") renderSummary();
}));
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape" && !$("drawer").hidden) $("toggleDrawer").click();
  const tab = ev.target.closest && ev.target.closest('[role="tab"]');
  if (tab && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
    const tabs = [...document.querySelectorAll('[role="tab"]')], i = tabs.indexOf(tab);
    const next = tabs[(i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    active = next.dataset.tab; render(); document.getElementById(next.id).focus();
  }
});

$("book").href = CONFIG.bookingUrl;
render();
})();
