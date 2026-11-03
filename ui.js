/* "Tape" layout: a step-by-step wizard, one service per screen, ending on a printed receipt. */
const S = createState();
let step = 0, period = "month";
const $ = id => document.getElementById(id);
const steps = () => ["pick", ...SERVICES.filter(s => S.selected.has(s.key)).map(s => s.key), "review"];
const nameOf = k => k === "pick" ? "Services" : k === "review" ? "Estimate" : SERVICES.find(s => s.key === k).name;

function receipt(e) {
  const k = period === "year" ? 12 : 1, sfx = period === "year" ? "per year" : "per month";
  const recurring = e.groups.some(g => g.lines.length);
  return `<div class="tape">
    <div class="sum-head">
      <div class="lbl">Estimated recurring fee</div>
      <div class="total">${recurring ? `${money(e.low * k)} – ${money(e.high * k)}<small>${sfx}</small>` : `<small>No recurring services</small>`}</div>
      ${e.customCount ? `<div class="note">${e.customCount} item${e.customCount > 1 ? "s" : ""} quoted separately by your CPA.</div>` : ""}
    </div>
    <div class="lines">${e.groups.filter(g => g.lines.length).map(g => `<div class="grp"><h3>${g.svc.name}<span>${money(g.sub * k)}</span></h3>${g.lines.map(l =>
      `<div class="row${l.monthly < 0 ? " neg" : ""}"><span>${esc(l.label)}</span><span class="${l.custom ? "cq" : ""}">${l.custom ? "Custom quote" : (l.monthly < 0 ? "−" : "") + money(Math.abs(l.monthly) * k)}</span></div>`).join("")}</div>`).join("")}</div>
    ${e.oneTime.length ? `<div class="onetime"><div class="lbl">One-time</div>${e.oneTime.map(o =>
      `<div class="row"><span>${esc(o.label)}</span><span class="${o.amount == null ? "cq" : ""}">${o.amount == null ? "Custom quote" : money(o.amount)}</span></div>`).join("")}</div>` : ""}
    <div class="foot">
      <a class="btn primary" href="${CONFIG.bookingUrl}" target="_blank" rel="noopener">Book a consultation</a>
      <button type="button" class="btn ghost" id="copy">Copy estimate summary</button>
      <p class="fine">Assumes clean, current records and a standard scope. Ranges include a ${CONFIG.rangeAllowance * 100}% allowance for complexity found during onboarding.</p>
    </div>
  </div>`;
}

function sectionNote(e, key) {
  const g = e.groups.find(g => g.svc.key === key);
  if (!g) return "";
  if (g.lines.length) return `This section adds <b>${money(g.sub)}/mo</b> to your estimate.`;
  if (g.oneTime.length) return `This is a one-time fee of <b>${g.oneTime[0].amount == null ? "custom quote" : money(g.oneTime[0].amount)}</b>.`;
  return "";
}

function light() {
  const e = estimate(S);
  $("running").textContent = e.groups.some(g => g.lines.length) ? `${money(e.low)} – ${money(e.high)}/mo` : "—";
  const n = $("secnote"); if (n) n.innerHTML = sectionNote(e, n.dataset.key);
}

function render() {
  const st = steps();
  if (step > st.length - 1) step = st.length - 1;
  const cur = st[step], e = estimate(S);
  $("rail").innerHTML = st.map((k, i) =>
    `<li><button type="button" data-step="${i}" aria-current="${i === step ? "step" : "false"}" class="${i < step ? "done" : ""}"><span class="n">${i < step ? "✓" : i + 1}</span>${esc(nameOf(k))}</button></li>`).join("");
  let html = `<p class="step">Step ${step + 1} of ${st.length}</p>`;
  if (cur === "pick") {
    html += `<h1>What can we help with?</h1>
      <p class="lede">Choose every service you want priced. You'll answer a few questions about each one, then get an itemized estimate.</p>
      <div class="picker">${SERVICES.map(s => `<button type="button" class="svc" id="svc-${s.key}" data-pick="${s.key}" aria-pressed="${S.selected.has(s.key)}"><b>${s.name}</b><small>${s.blurb}</small></button>`).join("")}</div>
      ${S.selected.size ? "" : `<p class="note">Choose at least one service to continue.</p>`}`;
  } else if (cur === "review") {
    html += `<h1>Your estimate</h1>
      <div class="period" role="group" aria-label="Show prices">${["month", "year"].map(p =>
        `<button type="button" id="p-${p}" data-period="${p}" aria-pressed="${period === p}">${p === "month" ? "Monthly" : "Annual"}</button>`).join("")}</div>
      ${receipt(e)}`;
  } else {
    const svc = SERVICES.find(s => s.key === cur);
    html += `<h1>${svc.name}</h1><p class="lede" id="secnote" data-key="${cur}">${sectionNote(e, cur)}</p><div class="fields">${renderFields(S, cur)}</div>`;
  }
  $("stage").innerHTML = html;
  $("back").disabled = step === 0;
  $("next").hidden = cur === "review";
  $("next").disabled = cur === "pick" && !S.selected.size;
  $("next").textContent = step === st.length - 2 ? "See estimate →" : "Next →";
  $("count").textContent = `${step + 1} / ${st.length}`;
  light();
}

const goTo = i => { step = i; render(); $("rail").scrollIntoView({ block: "nearest" }); };

document.addEventListener("click", ev => {
  const t = ev.target.closest("button"); if (!t) return;
  if (t.dataset.pick) { const k = t.dataset.pick; S.selected.has(k) ? S.selected.delete(k) : S.selected.add(k); render(); return; }
  if (t.dataset.step) { goTo(Number(t.dataset.step)); return; }
  if (t.dataset.period) { period = t.dataset.period; render(); return; }
  if (t.id === "back") { goTo(step - 1); return; }
  if (t.id === "next") { goTo(step + 1); return; }
  if (t.id === "copy") { copyText(summaryText(estimate(S), period), t); return; }
  if (handleFieldEvent(S, ev)) render();
});
["change", "input"].forEach(type => document.addEventListener(type, ev => {
  const r = handleFieldEvent(S, ev); if (r === "full") render(); else if (r === "light") light();
}));

render();
