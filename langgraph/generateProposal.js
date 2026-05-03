export const generateProposal = async (state) => {

  const totalBudget  = parseInt(state.budget) || 500000
  const perBenef     = Math.round(totalBudget / 45000)
  const personnel    = Math.round(totalBudget * 0.30)
  const construction = Math.round(totalBudget * 0.50)
  const training     = Math.round(totalBudget * 0.10)
  const meal         = Math.round(totalBudget * 0.06)
  const admin        = Math.round(totalBudget * 0.04)
  const saving       = Math.round((18 - perBenef) / 18 * 100)

  const prompt = `
You are a senior NGO grant writer. Write a professional donor-ready proposal.

Donor: ${state.donor}
Follow this donor's known guidelines and format.

NGO: ${state.ngo_name}
Topic: ${state.topic}
Region: ${state.region}
Budget: USD ${totalBudget}
Duration: ${state.duration} months
Problem: ${state.problem}
Beneficiaries: ${state.beneficiaries}
Budget Breakdown: ${state.budget_breakdown}
Sustainability: ${state.sustainability}

FIXED NUMBERS — use these exact figures in ALL sections. Never change them:
- Total Budget: USD ${totalBudget}
- Personnel: USD ${personnel}
- Construction: USD ${construction}
- Training: USD ${training}
- MEAL budget: USD ${meal}
- Admin: USD ${admin}
- Per Beneficiary Cost: USD ${perBenef}
- Sector Average Cost: USD 18
- Saving vs sector: ${saving}%

Section 1 = Section 8 budget MUST be identical.
Section 1 = Section 6 beneficiaries MUST be identical.

Outline to follow:
${state.outline}

Use exact numbers above. Do not invent statistics.

REALISTIC IMPACT TARGETS — use same targets in Section 1, 3, 4, and 9:
- Water access: 22% to 80% by Month 24
- Disease deaths: 340 to 136 per year — 60% reduction
- Women collection time: 4 hours to 20 minutes by Month 18
- Do not claim 100% — use 60-80% improvement only

Section 1 — Executive Summary — 300 words
Key numbers, funding ask, problem, solution, impact, donor alignment.
Use FIXED NUMBERS above.

Section 2 — Organization Profile — 300 words
Founding year, registration, past projects with results, team, credentials.

Section 3 — Problem Statement — 350 words
Use specific statistics from problem input.
WHO safe limit is 500m — current average 6.2km — 12x above safe limit.
Do not claim 100% elimination. Use 60-70% reduction targets.

Section 4 — Objectives — 300 words
Write exactly 6 SMART objectives:
Objective 1: Increase clean water access from 22% to 80% by Month 24 — SDG 6.1
Objective 2: Reduce waterborne disease deaths from 340 to 136 per year — SDG 3.2
Objective 3: Reduce women water collection from 4 hours to 20 minutes by Month 18 — SDG 5.4
Objective 4: Train 45 local technicians in O&M by Month 12 — SDG 6.b
Objective 5: Establish 15 water committees 60% women by Month 6 — SDG 5.5
Objective 6: Achieve ODF status in 10 villages by Month 20 — SDG 6.2

Section 5 — Methodology — 400 words
4 phases with month-by-month activities and community participation.

Section 6 — Beneficiaries — 250 words
Direct and indirect counts, gender breakdown, vulnerability analysis.
Use same beneficiary numbers as Section 1.

Section 7 — Timeline — 200 words
Month-by-month milestones with a simple table.

Section 8 — Budget — 350 words
Use FIXED NUMBERS above exactly.
Write this table:
Category | Line Item | Unit | Quantity | Unit Cost | Total Cost
Personnel | Project Manager | Person | 1 | USD 2500/mo | USD ${Math.round(personnel * 0.4)}
Personnel | Field Officers | Person | 3 | USD 1250/mo | USD ${Math.round(personnel * 0.6)}
Construction | Borehole drilling | Unit | 10 | USD ${Math.round(construction / 10)} | USD ${construction}
Training | Workshops | Session | 40 | USD 1000 | USD ${training}
MEAL | Evaluations | Event | 3 | USD ${Math.round(meal / 3)} | USD ${meal}
Admin | Operations | - | - | - | USD ${admin}
TOTAL | | | | | USD ${totalBudget}

Then write:
- Per beneficiary cost: USD ${perBenef} versus sector average USD 18 — ${saving}% below average
- Year 1: USD ${Math.round(totalBudget * 0.6)} — Year 2: USD ${Math.round(totalBudget * 0.4)}
- Admin: ${Math.round(admin / totalBudget * 100)}% — below 9% threshold

Section 9 — MEAL — 300 words
Write Theory of Change: Input to Output to Outcome to Impact.
Then write this exact table:
Indicator | Baseline | Target | Timeline | Source
HH with clean water access | 22% | 80% | M24 | Household survey
Disease deaths per year | 340 | 136 | M24 | Health records
Women collection time | 4 hours | 20 min | M18 | Survey
Committees active | 0 | 15 | M6 | Register
Technicians trained | 0 | 45 | M12 | Training records
User fee collection rate | 0% | 90% | M18 | Finance records

Data collection: Baseline M1, Midterm M12, Endline M24.
Reporting: Monthly progress, quarterly donor reports.
Independent evaluation: Mid-term M12, Final M24.

Section 10 — Risk Analysis — 300 words
Write exactly 6 risks in this format:
Risk name. Likelihood High Medium or Low. Impact High Medium or Low.
Mitigation with specific number or timeline. Responsible person. Monitoring method.

Section 11 — Sustainability — 300 words
Use sustainability plan provided. Community ownership, government integration, exit strategy.

Section 12 — Annexures — 150 words
List required attachments with descriptions.

Writing rules:
Replace vague phrases with specific facts. Every claim needs a number. Every outcome needs a metric.
Write in ${state.language}. Tone professional and formal.
`
  const proposal = await generateText(prompt, 4000)
  return { proposal }
}
