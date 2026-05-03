// langgraph/nodes.js
import { generateText } from '../services/aiProvider.js'

// ─────────────────────────────────────────────────────────────
// BUDGET CALCULATOR
// ─────────────────────────────────────────────────────────────
const calcBudget = (budget, beneficiaries) => {
  const total      = parseInt(budget) || 500000
  const benefStr   = (beneficiaries || '10000').toString()
  const benefNum   = parseInt(benefStr.replace(/[^0-9]/g, '')) || 10000
  const personnel  = Math.round(total * 0.30)
  const activities = Math.round(total * 0.50)
  const training   = Math.round(total * 0.10)
  const meal       = Math.round(total * 0.06)
  const admin      = Math.round(total * 0.04)
  const perBenef   = Math.round(total / benefNum)
  const year1      = Math.round(total * 0.60)
  const year2      = Math.round(total * 0.40)
  return {
    total, personnel, activities, training,
    meal, admin, perBenef, year1, year2, benefNum,
    adminPct: Math.round(admin / total * 100),
  }
}

// ─────────────────────────────────────────────────────────────
// INPUT QUALITY ANALYZER
// ─────────────────────────────────────────────────────────────
const analyzeInput = (state) => {
  const problem    = (state.problem || '').toLowerCase()
  const benefStr   = (state.beneficiaries || '').toLowerCase()
  const region     = (state.region || '').toLowerCase()
  let   penalty    = 0
  const issues     = []

  // Problem too short or generic
  if (problem.split(' ').length < 8) {
    penalty += 10
    issues.push('Problem statement too short — add specific statistics')
  }

  // No numbers in problem
  if (!problem.match(/\d+/)) {
    penalty += 10
    issues.push('Problem has no numbers — add percentages, counts, or distances')
  }

  // No technical detail
  const techWords = ['borehole','well','pipeline','filter','pump','tank','sanitation',
    'school','clinic','training','literacy','marriage','dropout','harvest','crop',
    'shelter','refugee','violence','malnutrition','vaccine','disease','contamination']
  const hasTech = techWords.some(w => problem.includes(w) || (state.topic||'').toLowerCase().includes(w))
  if (!hasTech) {
    penalty += 8
    issues.push('No technical intervention detail — specify type of solution')
  }

  // Beneficiaries not specific
  if (!benefStr.match(/\d+/) || benefStr.split(' ').length < 3) {
    penalty += 5
    issues.push('Beneficiaries vague — add count, gender, and age group')
  }

  // Region too broad
  if (region.split(' ').length < 2 || region.length < 6) {
    penalty += 3
    issues.push('Region too broad — add county, district, or specific area')
  }

  // Budget vs beneficiaries sanity check
  const b = calcBudget(state.budget, state.beneficiaries)
  if (b.perBenef > 200) {
    issues.push(`Per beneficiary cost USD ${b.perBenef} is high — justify in budget`)
  }
  if (b.perBenef < 2) {
    penalty += 5
    issues.push(`Per beneficiary cost USD ${b.perBenef} is unrealistically low`)
  }

  return {
    penalty:       Math.min(penalty, 30),
    issues,
    inputGrade:    penalty === 0 ? 'Strong' : penalty <= 10 ? 'Average' : 'Weak',
  }
}

// ─────────────────────────────────────────────────────────────
// NODE 1 — Outline + Details
// ─────────────────────────────────────────────────────────────
export const generateOutline = async (state) => {
  const b        = calcBudget(state.budget, state.beneficiaries)
  const inputQA  = analyzeInput(state)

  const prompt = `
You are an expert NGO grant writer.
Generate structured proposal data and a 12-section outline.

NGO: ${state.ngo_name}
Topic: ${state.topic}
Region: ${state.region}
Donor: ${state.donor}
Duration: ${state.duration} months
Problem: ${state.problem}
Beneficiaries: ${state.beneficiaries}

LOCKED BUDGET — copy exactly, do NOT recalculate:
Total: USD ${b.total}
Personnel 30%: USD ${b.personnel}
Activities 50%: USD ${b.activities}
Training 10%: USD ${b.training}
MEAL 6%: USD ${b.meal}
Admin 4%: USD ${b.admin}
Per beneficiary: USD ${b.perBenef}
Year 1: USD ${b.year1}
Year 2: USD ${b.year2}

Return in EXACTLY this format:

BUDGET_BREAKDOWN:
Personnel USD ${b.personnel} — Project Manager USD ${Math.round(b.personnel*0.4)}, Field Officers x3 USD ${Math.round(b.personnel*0.4)}, Community Liaisons x2 USD ${Math.round(b.personnel*0.2)}.
Activities USD ${b.activities} — core project delivery, materials, equipment.
Training USD ${b.training} — community workshops x30 USD ${Math.round(b.training/30)} each.
MEAL USD ${b.meal} — Baseline M1 USD ${Math.round(b.meal/3)}, Midterm USD ${Math.round(b.meal/3)}, Endline M${state.duration} USD ${Math.round(b.meal/3)}.
Admin USD ${b.admin} — office, transport, communications. Rate ${b.adminPct}% below 9% ceiling.
TOTAL USD ${b.total}. Per beneficiary USD ${b.perBenef}. Sector average USD 45.

SUSTAINABILITY:
Month 1: Form 20 community committees 60% women.
Month 3: Train 50 local staff in operations.
Month 6: Community-led monitoring system active.
Month 9: MOU signed with ${state.region} government.
Month 12: Community contributions cover 100% maintenance.
Month ${state.duration}: Full handover to government.

BENEFICIARY_DETAILS:
Direct: ${b.benefNum}. Women 60%: ${Math.round(b.benefNum*0.6)}. Men 40%: ${Math.round(b.benefNum*0.4)}.
Children under 12: ${Math.round(b.benefNum*0.3)}. Poorest households: ${Math.round(b.benefNum*0.6)}.
Disability 5%: ${Math.round(b.benefNum*0.05)}. Indirect: ${b.benefNum*3}.

OUTLINE:
1. Executive Summary — USD ${b.total}, ${state.duration} months, ${b.benefNum} beneficiaries
2. Organization Profile — registration, past projects, team
3. Problem Statement — statistics, root causes, gap analysis
4. Objectives — 6 SMART SDG-linked with baseline and target
5. Methodology — 4 phases month by month
6. Beneficiaries — ${b.benefNum} direct, ${b.benefNum*3} indirect, gender breakdown
7. Timeline — milestones, Gantt table
8. Budget — line item table, per beneficiary USD ${b.perBenef}
9. MEAL — Theory of Change, 6 indicators, baseline midterm endline
10. Risk Analysis — 6 risks with mitigation
11. Sustainability — community ownership, government MOU, exit
12. Annexures — registration, audits, CVs, support letters
`
  const raw = await generateText(prompt, 2000)

  const budgetMatch  = raw.match(/BUDGET_BREAKDOWN:\n([\s\S]*?)(?=SUSTAINABILITY:)/)
  const sustainMatch = raw.match(/SUSTAINABILITY:\n([\s\S]*?)(?=BENEFICIARY_DETAILS:)/)
  const benefMatch   = raw.match(/BENEFICIARY_DETAILS:\n([\s\S]*?)(?=OUTLINE:)/)
  const outlineMatch = raw.match(/OUTLINE:\n([\s\S]*)/)

  const fb = `Personnel USD ${b.personnel}. Activities USD ${b.activities}. Training USD ${b.training}. MEAL USD ${b.meal}. Admin USD ${b.admin}. Total USD ${b.total}. Per beneficiary USD ${b.perBenef} vs sector USD 45.`
  const fs = `Month 1 committees. Month 6 monitoring. Month 9 government MOU. Month ${state.duration} full handover.`
  const fn = `Direct ${b.benefNum}: Women ${Math.round(b.benefNum*0.6)}, Men ${Math.round(b.benefNum*0.4)}, Children ${Math.round(b.benefNum*0.3)}. Indirect ${b.benefNum*3}.`

  return {
    outline:          outlineMatch  ? outlineMatch[1].trim()  : raw,
    budget_breakdown: budgetMatch   ? budgetMatch[1].trim()   : fb,
    sustainability:   sustainMatch  ? sustainMatch[1].trim()  : fs,
    beneficiaries:    benefMatch    ? benefMatch[1].trim()    : fn,
    _budget:          b,
    _inputQA:         inputQA,
  }
}

// ─────────────────────────────────────────────────────────────
// NODE 2 — Full Proposal
// ─────────────────────────────────────────────────────────────
export const generateProposal = async (state) => {
  const b = state._budget || calcBudget(state.budget, state.beneficiaries)

  const prompt = `
You are a senior NGO grant writer. Write a complete professional donor-ready proposal.

Donor: ${state.donor}
Follow this donor's known format and terminology.

NGO: ${state.ngo_name}
Topic: ${state.topic}
Region: ${state.region}
Duration: ${state.duration} months
Problem: ${state.problem}
Beneficiaries: ${state.beneficiaries}
Budget Breakdown: ${state.budget_breakdown}
Sustainability: ${state.sustainability}
Outline: ${state.outline}

LOCKED NUMBERS — COPY exactly. Do NOT recalculate:
Total Budget: USD ${b.total}
Personnel: USD ${b.personnel}
Activities: USD ${b.activities}
Training: USD ${b.training}
MEAL: USD ${b.meal}
Admin: USD ${b.admin}
Per Beneficiary: USD ${b.perBenef}
Sector Average: USD 45
Year 1: USD ${b.year1}
Year 2: USD ${b.year2}
Admin Rate: ${b.adminPct}%
Direct Beneficiaries: ${b.benefNum}
Indirect Beneficiaries: ${b.benefNum*3}

Section 1 = Section 6 = Section 8 beneficiary numbers must be IDENTICAL: ${b.benefNum}

REALISTIC TARGETS — use same in Sections 1, 3, 4, 9:
Improvement targets: 60-80% not 100%.
Show baseline and target for each indicator.
Use WHO benchmark comparisons where relevant.

Section 1 — Executive Summary — 300 words
USD ${b.total} request. ${state.duration} months. ${b.benefNum} direct beneficiaries.
Core problem statistics. Solution. Expected outcomes 60-80% improvement. Donor alignment.

Section 2 — Organization Profile — 300 words
Registration. Year founded. Past 3 projects with numbers. Team. Partnerships. Track record.

Section 3 — Problem Statement — 350 words
Statistics from problem input. WHO benchmark comparison. Root causes. Gap analysis.

Section 4 — Objectives — 300 words
Exactly 6 SMART objectives. Each with SDG number, baseline, target, deadline.
Use 60-80% improvement. Format: Objective N: [target] by Month X — SDG X.X

Section 5 — Methodology — 400 words
Phase 1 M1-M${Math.round(parseInt(state.duration)*0.25)}: Baseline, engagement, procurement.
Phase 2 M${Math.round(parseInt(state.duration)*0.25)}-M${Math.round(parseInt(state.duration)*0.60)}: Main delivery.
Phase 3 M${Math.round(parseInt(state.duration)*0.60)}-M${Math.round(parseInt(state.duration)*0.85)}: Training, monitoring.
Phase 4 M${Math.round(parseInt(state.duration)*0.85)}-M${state.duration}: Evaluation, handover.

Section 6 — Beneficiaries — 250 words
Direct: ${b.benefNum}. Women: ${Math.round(b.benefNum*0.6)}. Men: ${Math.round(b.benefNum*0.4)}.
Children: ${Math.round(b.benefNum*0.3)}. Disability: ${Math.round(b.benefNum*0.05)}.
Indirect: ${b.benefNum*3}. Selection criteria. Vulnerability. Coverage.

Section 7 — Timeline — 200 words
Month by month milestones. Table: Month, Activity, Deliverable.

Section 8 — Budget — 350 words
Category | Line Item | Qty | Unit Cost | Total USD
Personnel | Project Manager | 1 | ${Math.round(b.personnel*0.4/parseInt(state.duration))}/mo | ${Math.round(b.personnel*0.4)}
Personnel | Field Officers | 3 | ${Math.round(b.personnel*0.3/3/parseInt(state.duration))}/mo | ${Math.round(b.personnel*0.3)}
Personnel | Liaisons | 2 | ${Math.round(b.personnel*0.3/2/parseInt(state.duration))}/mo | ${Math.round(b.personnel*0.3)}
Activities | Core Delivery | - | - | ${b.activities}
Training | Workshops | 30 | ${Math.round(b.training/30)} | ${b.training}
MEAL | Evaluations | 3 | ${Math.round(b.meal/3)} | ${b.meal}
Admin | Operations | - | - | ${b.admin}
TOTAL | | | | ${b.total}
Year 1: USD ${b.year1}. Year 2: USD ${b.year2}.
Per beneficiary: USD ${b.perBenef} vs sector USD 45.
Admin: ${b.adminPct}% below 9% ceiling.

Section 9 — MEAL — 300 words
Theory of Change: Inputs to Outputs to Outcomes to Impact.
Indicator | Baseline | Target | Timeline | Source
Primary outcome 1 | [from problem] | 60-80% improvement | M${state.duration} | Survey
Primary outcome 2 | [from problem] | measurable target | M${state.duration} | Records
Access indicator | [baseline] | [target] | M${Math.round(parseInt(state.duration)*0.75)} | Survey
Committees formed | 0 | 20 | M6 | Register
Staff trained | 0 | 50 | M12 | Training records
Contribution rate | 0% | 90% | M${Math.round(parseInt(state.duration)*0.75)} | Finance
Baseline M1. Midterm M${Math.round(parseInt(state.duration)/2)}. Endline M${state.duration}.

Section 10 — Risk Analysis — 300 words
Exactly 6 risks:
Risk N — Name | Likelihood: H/M/L | Impact: H/M/L
Mitigation: [specific action with number]. Responsible: [role]. Monitoring: [frequency].
Risks: climate, community resistance, budget overrun, staff turnover, government policy, supply chain.

Section 11 — Sustainability — 300 words
Community ownership timeline. Government MOU. Revenue model. Exit strategy.

Section 12 — Annexures — 150 words
Registration. Audited accounts 3 years. CVs. Support letters. Maps. Baseline data.

Writing: COPY numbers exactly. Every claim needs number. Professional tone.
Write in ${state.language}.
`
  const proposal = await generateText(prompt, 4000)
  return { proposal }
}

// ─────────────────────────────────────────────────────────────
// NODE 3 — Realistic Evaluator with Specificity Penalty
// ─────────────────────────────────────────────────────────────
export const evaluateProposal = async (state) => {
  const b       = state._budget || calcBudget(state.budget, state.beneficiaries)
  const inputQA = state._inputQA || analyzeInput(state)

  const proposalText = state.proposal || ''
  const execMatch    = proposalText.match(/(?:Section 1|Executive Summary)[\s\S]{0,1500}(?=(?:Section 2|Organization))/)
  const budgetMatch  = proposalText.match(/(?:Section 8|Budget)[\s\S]{0,1500}(?=(?:Section 9|MEAL|Monitoring))/)
  const mealMatch    = proposalText.match(/(?:Section 9|MEAL|Monitoring)[\s\S]{0,1000}(?=(?:Section 10|Risk))/)
  const riskMatch    = proposalText.match(/(?:Section 10|Risk Analysis|Risk)[\s\S]{0,1000}(?=(?:Section 11|Sustainability))/)
  const sustainMatch = proposalText.match(/(?:Section 11|Sustainability)[\s\S]{0,800}(?=(?:Section 12|Annexures))/)

  const execSection    = execMatch    ? execMatch[0]    : proposalText.slice(0, 800)
  const budgetSection  = budgetMatch  ? budgetMatch[0]  : proposalText.slice(-2000, -1200)
  const mealSection    = mealMatch    ? mealMatch[0]    : proposalText.slice(-1200, -600)
  const riskSection    = riskMatch    ? riskMatch[0]    : proposalText.slice(-600)
  const sustainSection = sustainMatch ? sustainMatch[0] : ''

  const prompt = `
You are a strict grant evaluator at ${state.donor || 'an international donor'}.
You are evaluating this proposal for real funding. Be honest and realistic.

EXECUTIVE SUMMARY:
${execSection}

BUDGET SECTION:
${budgetSection}

MEAL SECTION:
${mealSection}

RISK SECTION:
${riskSection}

SUSTAINABILITY:
${sustainSection}

USER RAW INPUTS (evaluate these for specificity):
Problem: "${state.problem}"
Beneficiaries: "${state.beneficiaries}"
Region: "${state.region}"
Budget: USD ${b.total}
Per beneficiary: USD ${b.perBenef}

SCORING CRITERIA:

Clarity (0-25): Structure, specific language, zero ambiguity, professional tone.
Feasibility (0-25): Realistic timeline, budget matches activities, team credible.
Impact (0-30): Metrics clear, SDG linked, gender mainstreamed, baselines shown.
Budget Fit (0-20): Line items justified, per beneficiary cost, VfM, admin under 9%.

MANDATORY DEDUCTIONS — apply these strictly:

Problem specificity:
- Problem under 8 words OR no numbers: minus 10 points
- No technical intervention detail (borehole, filter, school, clinic etc): minus 8 points
- Generic statements only: minus 8 points

Beneficiary specificity:
- Beneficiaries vague (just a number, no breakdown): minus 5 points
- No gender disaggregation: minus 3 points

Structure deductions:
- Generic language without numbers: minus 3
- No statistics in proposal: minus 3
- No budget line item table: minus 5
- Donor format missing: minus 4
- Sustainability missing or weak: minus 3
- No risk mitigation details: minus 3
- No MEAL indicators table: minus 4
- Vague phrases committed to or dedicated to: minus 2 each

DO NOT deduct if present:
- MEAL indicator table exists: no MEAL deduction
- 6 risks with mitigation exist: no risk deduction
- Budget table with line items exists: no budget deduction
- Specific numbers throughout: no generic deduction

ADD points only if genuinely present:
- Local government partnership proven: plus 2
- WHO or global benchmark data used: plus 2
- Innovation angle clear: plus 2

REALISTIC SCORING GUIDE:
Weak generic input (no numbers, no specifics): 45-60
Average input (some numbers, partial specifics): 60-75
Good input (numbers present, intervention clear): 75-85
Excellent input (statistics, breakdown, benchmarks): 85-95

Return ONLY valid JSON. No markdown. No text outside JSON:
{
  "clarity": 0,
  "feasibility": 0,
  "impact": 0,
  "budget_fit": 0,
  "total": 0,
  "grade": "Excellent or Good or Average or Poor",
  "feedback": "3-4 specific honest lines",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "deductions": ["specific deduction 1", "specific deduction 2"],
  "improvements": ["fix 1", "fix 2"]
}
`
  const raw = await generateText(prompt, 1000)

  let result = {
    clarity: 0, feasibility: 0, impact: 0,
    budget_fit: 0, total: 0, grade: 'N/A',
    feedback: '', strengths: [], weaknesses: [],
    deductions: [], improvements: []
  }

  try {
    const jsonStart = raw.indexOf('{')
    const jsonEnd   = raw.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      result = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    }
  } catch {
    result.feedback = 'Evaluation parsing failed'
    result.total    = 60
  }

  // Apply input quality penalty on top
  const finalScore = Math.max(0, result.total - inputQA.penalty)

  return {
    score:        finalScore,
    raw_score:    result.total,
    input_penalty: inputQA.penalty,
    input_grade:  inputQA.inputGrade,
    input_issues: inputQA.issues,
    feedback:     result.feedback,
    breakdown:    result
  }
}

// ─────────────────────────────────────────────────────────────
// NODE 4 — Generic Check
// ─────────────────────────────────────────────────────────────
export const checkGeneric = async (state) => {
  const prompt = `
Check if this NGO proposal is specific or generic.
Evaluate the USER INPUT quality, not just the AI-generated proposal.

User inputs:
Problem: "${state.problem}"
Beneficiaries: "${state.beneficiaries}"
Region: "${state.region}"
NGO: "${state.ngo_name}"
Donor: "${state.donor}"

Proposal beginning:
${(state.proposal || '').slice(0, 1000)}

Check:
1. Is NGO name ${state.ngo_name} mentioned in proposal?
2. Is region ${state.region} specifically mentioned?
3. Are real numbers from problem input used?
4. Is donor ${state.donor} format followed?
5. Is problem community-specific not generic?

Calculate generic_score 0-100:
- No NGO name: add 20
- No specific region: add 20
- No real numbers: add 25
- No donor format: add 20
- Generic problem: add 15

Return ONLY valid JSON:
{
  "is_generic": false,
  "generic_score": 0,
  "checks": {
    "ngo_mentioned": true,
    "region_specific": true,
    "real_numbers": true,
    "donor_format": true,
    "problem_specific": true
  },
  "generic_issues": [],
  "verdict": "Specific"
}
`
  const raw = await generateText(prompt, 500)

  try {
    const jsonStart = raw.indexOf('{')
    const jsonEnd   = raw.lastIndexOf('}')
    const result    = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return { generic_check: result }
  } catch {
    return {
      generic_check: {
        is_generic: false,
        generic_score: 0,
        verdict: 'Check failed',
        checks: {},
        generic_issues: []
      }
    }
  }
}
