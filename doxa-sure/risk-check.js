const $ = (id) => document.getElementById(id);

function assessRisk({ arrears, incomeShock, legalStage, creditLife }) {
  let points = 0;
  let level = 'green';
  const actions = [];

  const missed = Number(arrears || 0);
  points += [0, 2, 4, 6][Math.min(missed, 3)];
  if (incomeShock === 'reduced') points += 2;
  if (incomeShock === 'lost' || incomeShock === 'illness') points += 4;
  if (legalStage === 'collections') points += 1;
  if (legalStage === 's129') points += 5;
  if (legalStage === 'summons') points += 8;
  if (legalStage === 'execution') points += 10;

  if (legalStage === 'execution' || legalStage === 'summons') level = 'critical';
  else if (legalStage === 's129' || missed >= 2 || points >= 7) level = 'red';
  else if (missed === 1 || incomeShock !== 'none' || points >= 3) level = 'amber';

  if (level === 'green') {
    actions.push('Keep your key finance documents together and watch upcoming payment dates.');
    actions.push('Confirm whether any credit-life or payment-protection cover exists before a crisis develops.');
  }
  if (level === 'amber') {
    actions.push('Act before another instalment is missed. Build a dated record of income changes, payment dates and lender communications.');
    actions.push('Use DOXA-SURE Shield to organise the asset, arrears position and documents early.');
  }
  if (level === 'red') {
    actions.push('Treat this as urgent. Organise statements, notices, income evidence and lender communications now.');
    actions.push('A human Rescue Readiness Pack can prepare the facts and referral file for the appropriate lender, insurer or authorised professional process.');
  }
  if (level === 'critical') {
    actions.push('Formal legal/enforcement documents require urgent attention from a suitably qualified professional.');
    actions.push('This check does not stop a summons, court deadline, repossession process or sale-in-execution timetable.');
  }
  if (creditLife === 'unknown') actions.push('Locate the original credit agreement or policy documents so existing credit-life/payment-protection cover can be identified.');

  return { level, points, actions };
}

function label(level) {
  return ({ green: 'GREEN — PREPARED', amber: 'AMBER — ACT EARLY', red: 'RED — URGENT', critical: 'CRITICAL — PROFESSIONAL HELP NOW' })[level];
}

$('riskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = {
    asset: $('asset').value,
    arrears: $('arrears').value,
    incomeShock: $('incomeShock').value,
    legalStage: $('legalStage').value,
    creditLife: $('creditLife').value,
  };
  const result = assessRisk(input);
  const box = $('riskResult');
  box.classList.remove('hidden');
  box.innerHTML = `
    <span class="risk-badge ${result.level}">${label(result.level)}</span>
    <h2>Your DOXA-SURE urgency result</h2>
    <p>This is an early-warning triage result, not a legal or financial-product recommendation.</p>
    <ul class="risk-list">${result.actions.map((item) => `<li>${item}</li>`).join('')}</ul>
    <div class="cta-row">
      <a class="btn rescue" href="./index.html#authCard">START MY SHIELD</a>
      <a class="btn secondary" href="./index.html#authCard">REQUEST R199 RESCUE PACK</a>
    </div>
  `;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
