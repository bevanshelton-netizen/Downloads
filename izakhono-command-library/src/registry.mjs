export const COMMANDS = Object.freeze([
  {
    id: "devilsadvocate",
    aliases: ["devils-advocate", "opposition"],
    category: "reasoning",
    summary: "Argue the strongest reasonable opposing viewpoint.",
    instruction: "Construct the strongest good-faith opposing case. Separate objections supported by evidence from hypothetical concerns. Do not manufacture facts.",
    verification: "Cite or flag any factual premise that materially affects the opposing case."
  },
  {
    id: "contrarian",
    aliases: ["counterview", "alternative-view"],
    category: "reasoning",
    summary: "Find credible alternative perspectives.",
    instruction: "Generate materially different perspectives, including minority or non-obvious views, without treating novelty as correctness.",
    verification: "Label perspectives as evidence-backed, plausible inference, or speculation."
  },
  {
    id: "assumptions",
    aliases: ["assume", "hidden-assumptions"],
    category: "reasoning",
    summary: "Identify hidden assumptions.",
    instruction: "List explicit and hidden assumptions, explain why each matters, and identify which assumptions should be tested first.",
    verification: "Distinguish assumptions from facts already established in the supplied context."
  },
  {
    id: "risks",
    aliases: ["risk", "riskcheck"],
    category: "reasoning",
    summary: "Identify practical risks and mitigations.",
    instruction: "Identify operational, financial, legal, security, privacy, reputational, dependency and execution risks relevant to the task. Pair each material risk with a mitigation and an early warning signal.",
    verification: "Do not present hypothetical risks as confirmed incidents."
  },
  {
    id: "factcheck",
    aliases: ["facts", "claimcheck"],
    category: "reasoning",
    summary: "Separate supported facts from claims.",
    instruction: "Extract factual claims, classify each as supported, unsupported, disputed, outdated or not verifiable from the supplied evidence, and state what source would resolve uncertainty.",
    verification: "Never convert an unsupported claim into a fact."
  },
  {
    id: "verify",
    aliases: ["verification", "proof"],
    category: "reasoning",
    summary: "Identify what still needs independent verification.",
    instruction: "Produce a verification checklist focused on facts that could change the decision, transaction, deployment, compliance position or user outcome.",
    verification: "Prefer primary or authoritative evidence when the subject is regulated, financial, legal, medical, security-sensitive or time-sensitive."
  },
  {
    id: "logic",
    aliases: ["reasoning", "logiccheck"],
    category: "reasoning",
    summary: "Check reasoning for gaps and contradictions.",
    instruction: "Test the reasoning chain for contradictions, non sequiturs, circularity, false dichotomies, unsupported causation and missing alternatives. Explain issues without revealing private chain-of-thought.",
    verification: "Assess the stated reasoning and evidence, not hidden mental-state assumptions."
  },
  {
    id: "rootcause",
    aliases: ["root-cause", "rca"],
    category: "operations",
    summary: "Find the likely root cause of a problem.",
    instruction: "Separate symptoms, contributing factors and candidate root causes. Use a falsifiable diagnostic sequence and identify the next observation or test that would discriminate between causes.",
    verification: "Do not call a cause confirmed until evidence rules out credible alternatives."
  },
  {
    id: "debug",
    aliases: ["fix", "diagnose"],
    category: "technology",
    summary: "Diagnose and fix a technical problem.",
    instruction: "Reproduce or isolate the failure, identify the smallest plausible fault domain, propose a reversible fix, and specify a verification test plus rollback.",
    verification: "Prefer evidence from logs, tests, health checks and exact failing conditions."
  },
  {
    id: "solution",
    aliases: ["solve", "actionplan"],
    category: "operations",
    summary: "Generate an executable solution.",
    instruction: "Turn the problem into a practical sequence of actions with dependencies, owner roles, success criteria and rollback where relevant. Prefer the smallest path that solves the real problem.",
    verification: "Mark any step that depends on an unverified prerequisite."
  },
  {
    id: "alternative",
    aliases: ["alternatives", "better-option"],
    category: "reasoning",
    summary: "Suggest materially different alternatives.",
    instruction: "Generate alternatives that change the approach, not just wording. Compare trade-offs, dependencies, reversibility and cost drivers without forcing a single choice.",
    verification: "State when an alternative depends on assumptions or unavailable evidence."
  },
  {
    id: "cashflow",
    aliases: ["cash-flow", "runway"],
    category: "commercial",
    summary: "Analyse cash flow and runway.",
    instruction: "Map inflows, outflows, timing gaps, committed obligations, uncertainty and cash-preservation levers. Separate accounting profit from cash availability.",
    verification: "Do not invent balances or transaction values. Require current figures for numerical conclusions."
  },
  {
    id: "funding",
    aliases: ["finance", "capital"],
    category: "commercial",
    summary: "Structure a funding-readiness plan.",
    instruction: "Identify funding purpose, amount, use of funds, evidence pack, repayment or return logic, milestones, risks and likely funder questions. Keep grants, debt and equity structurally distinct.",
    verification: "Flag eligibility, pricing and programme availability as needing current verification."
  },
  {
    id: "marketing",
    aliases: ["campaign", "go-to-market"],
    category: "commercial",
    summary: "Build a practical marketing plan.",
    instruction: "Define audience, problem, promise, proof, offer, channel, creative, CTA, measurement and follow-up. Avoid unsupported superiority or guaranteed-outcome claims.",
    verification: "Distinguish tested conversion evidence from proposed messaging."
  },
  {
    id: "sales",
    aliases: ["sell", "pipeline"],
    category: "commercial",
    summary: "Build a sales conversion plan.",
    instruction: "Define target account, buying role, need, qualification, outreach, discovery, proposal, objections, next action and pipeline evidence.",
    verification: "Do not fabricate prospect intent, budgets or authority."
  },
  {
    id: "pricing",
    aliases: ["price", "monetise"],
    category: "commercial",
    summary: "Design pricing and packaging.",
    instruction: "Frame customer value, cost drivers, willingness-to-pay hypotheses, tiers, usage limits, margin pressure and upgrade logic. Include a test plan rather than assuming the optimal price.",
    verification: "Treat market pricing as time-sensitive evidence, not memory, when exact competitor prices matter."
  },
  {
    id: "compliance",
    aliases: ["regulatory", "compliancecheck"],
    category: "compliance",
    summary: "Create a compliance-readiness checklist.",
    instruction: "Identify the applicable compliance questions, evidence, control owners, deadlines and escalation points. Do not substitute the command engine for a regulator, attorney or licensed professional.",
    verification: "Require current primary-source verification for laws, regulations, official standards and filing deadlines."
  },
  {
    id: "contractreview",
    aliases: ["contract", "agreement"],
    category: "compliance",
    summary: "Review a contract for issues requiring attention.",
    instruction: "Summarise obligations, payment terms, term/termination, liability, IP, confidentiality, data, dispute, governing-law and unusual clauses. Identify questions for legal review rather than giving a definitive legal opinion.",
    verification: "Jurisdiction and current law must be verified before legal conclusions."
  },
  {
    id: "sars",
    aliases: ["tax", "south-africa-tax"],
    category: "compliance",
    summary: "Prepare a SARS/tax-readiness analysis.",
    instruction: "Organise the tax question, dates, amounts, entity type, evidence and potential filing or recordkeeping implications. Do not manufacture deductions, hide income or present unverified tax treatment as settled.",
    verification: "Use current official SARS guidance/tables and require professional confirmation for consequential decisions."
  },
  {
    id: "payroll",
    aliases: ["paye", "salary"],
    category: "compliance",
    summary: "Check payroll readiness and controls.",
    instruction: "Review gross-to-net inputs, PAYE/UIF/SDL assumptions, period, evidence, approvals, exceptions and reconciliation controls. Do not finalise regulated payroll from unverified rates.",
    verification: "Current official rates/tables and payroll-professional validation are required before live finalisation."
  },
  {
    id: "ecd",
    aliases: ["early-childhood", "ecd360"],
    category: "operations",
    summary: "Apply ECD operating context.",
    instruction: "Frame the task around centre operations, admissions, attendance, learning, family communication, staff, finance, safety and compliance while keeping child data minimised and role-scoped.",
    verification: "Do not make medical, safeguarding or eligibility decisions automatically."
  },
  {
    id: "admissions",
    aliases: ["enrolment", "enrollment"],
    category: "operations",
    summary: "Improve admissions and enrolment conversion.",
    instruction: "Map enquiry, tour, application, offer, acceptance and enrolment. Keep prospect data separate from enrolled-child records until conversion is authorised.",
    verification: "Do not infer consent or create child/guardian access from marketing interest."
  },
  {
    id: "fraudcheck",
    aliases: ["fraud", "fortress"],
    category: "security",
    summary: "Assess fraud indicators and verification steps.",
    instruction: "Identify fraud indicators, evidence gaps, transaction anomalies and verification steps. Use explainable risk factors and avoid declaring a person fraudulent without evidence.",
    verification: "Separate risk signals from confirmed fraud and preserve human review for consequential actions."
  },
  {
    id: "security",
    aliases: ["secure", "threatmodel"],
    category: "security",
    summary: "Run a practical security review.",
    instruction: "Assess assets, trust boundaries, authentication, authorization, secrets, supply chain, data exposure, abuse cases, logging, backup, recovery and least privilege. Prefer reversible mitigations and explicit verification.",
    verification: "Do not claim a system secure without current test evidence."
  },
  {
    id: "website",
    aliases: ["site", "landingpage"],
    category: "creative",
    summary: "Design a conversion-focused website.",
    instruction: "Define visitor intent, hero promise, proof, product/service explanation, visuals, CTA, trust/legal elements, mobile behaviour and conversion path. Keep claims supportable.",
    verification: "Do not label a site live until its public HTTPS route and intended experience are verified."
  },
  {
    id: "launch",
    aliases: ["golive", "release"],
    category: "operations",
    summary: "Prepare a launch with evidence-based gates.",
    instruction: "Build a launch checklist covering product, security, data, payments, legal, observability, backup, rollback, public HTTPS and customer experience. Preserve the last verified fallback until the replacement passes.",
    verification: "Use evidence-based status labels; never equate a successful build with public launch."
  }
]);

const byName = new Map();
for (const command of COMMANDS) {
  byName.set(command.id, command);
  for (const alias of command.aliases || []) byName.set(alias, command);
}

export function getCommand(name) {
  return byName.get(String(name || "").trim().toLowerCase().replace(/^\//, "")) || null;
}

export function listCommands({ category } = {}) {
  if (!category) return COMMANDS;
  return COMMANDS.filter((command) => command.category === category);
}

export function commandNames() {
  return [...byName.keys()].sort();
}
