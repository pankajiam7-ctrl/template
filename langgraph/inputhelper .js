// controllers/inputHelper.js
// AI generates donor-specific guidance when input is weak
// Returns: { donor_priorities, problem_hints, problem_example,
//            budget_example, beneficiaries_hint }

import { generateText } from '../services/aiProvider.js'

export const generateHelp = async (body) => {
    const { topic, region, budget, donor, problem } = body

    const bgt = parseInt(budget) || 500000

    const prompt = `
You are an expert NGO grant consultant.
A user wants to apply for a grant but their input is weak.
Help them improve it with specific, actionable guidance.

User details:
- Topic: ${topic}
- Region: ${region}
- Budget: USD ${budget}
- Donor: ${donor || 'International Donors'}
- Current problem statement: "${problem}"

Return guidance in EXACTLY this format with these headers:

DONOR_PRIORITIES:
List 3 specific things ${donor || 'this donor'} prioritizes for ${topic} projects

PROBLEM_HINTS:
List 3 specific statistics the user should research for ${topic} in ${region}
Include data sources like WHO, UNICEF, World Bank, government surveys

PROBLEM_EXAMPLE:
Write a strong 3-sentence problem statement specific to ${topic} in ${region}
Use realistic statistics. Align with ${donor || 'donor'} priorities.
Do NOT use generic language.

BUDGET_EXAMPLE:
Personnel 30%: USD ${Math.round(bgt * 0.30)} — list specific roles for ${topic}
Activities 50%: USD ${Math.round(bgt * 0.50)} — list main activities for ${topic}
Training 10%: USD ${Math.round(bgt * 0.10)} — list training types for ${topic}
MEAL 6%: USD ${Math.round(bgt * 0.06)} — baseline, midterm, endline evaluation
Admin 4%: USD ${Math.round(bgt * 0.04)} — office, transport, communications
Per beneficiary: USD [realistic amount for ${topic}] — explain why

BENEFICIARIES_HINT:
How many beneficiaries is realistic for USD ${budget} for ${topic} in ${region}
Include: total count, gender breakdown, age groups, direct vs indirect
`

    const raw = await generateText(prompt, 1500)

    const donorMatch = raw.match(/DONOR_PRIORITIES:\n([\s\S]*?)(?=PROBLEM_HINTS:)/)
    const hintsMatch = raw.match(/PROBLEM_HINTS:\n([\s\S]*?)(?=PROBLEM_EXAMPLE:)/)
    const exampleMatch = raw.match(/PROBLEM_EXAMPLE:\n([\s\S]*?)(?=BUDGET_EXAMPLE:)/)
    const budgetMatch = raw.match(/BUDGET_EXAMPLE:\n([\s\S]*?)(?=BENEFICIARIES_HINT:)/)
    const benefMatch = raw.match(/BENEFICIARIES_HINT:\n([\s\S]*)/)

    return {
        donor_priorities: donorMatch ? donorMatch[1].trim() : '',
        problem_hints: hintsMatch ? hintsMatch[1].trim() : '',
        problem_example: exampleMatch ? exampleMatch[1].trim() : '',
        budget_example: budgetMatch ? budgetMatch[1].trim() : '',
        beneficiaries_hint: benefMatch ? benefMatch[1].trim() : '',
    }
}