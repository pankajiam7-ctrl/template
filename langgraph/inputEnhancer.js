// langgraph/inputEnhancer.js
// NODE 0 — Input Validator + Enhancer
// Runs BEFORE outline generation
// Checks weak inputs and generates missing fields per donor

import { generateText } from '../services/aiProvider.js'

export const enhanceInput = async (state) => {

  const prompt = `
You are an expert NGO grant consultant.
A user has submitted a grant proposal form. Your job is to:
1. Analyze the quality of their input
2. Identify what is weak or missing based on the donor
3. Generate enhanced versions of weak fields
4. Add missing fields: beneficiaries, sustainability, budget_breakdown

USER INPUT:
Topic: ${state.topic}
NGO: ${state.ngo_name}
Region: ${state.region}
Budget: USD ${state.budget}
Duration: ${state.duration} months
Donor: ${state.donor}
Problem: ${state.problem}
Budget Breakdown: ${state.budget_breakdown || 'NOT PROVIDED'}

DONOR PROFILE:
Based on donor "${state.donor}", identify:
- What this donor prioritizes
- What language and terminology they use
- What sections they scrutinize most
- What per-beneficiary cost is acceptable
- What sustainability evidence they require

TASK 1 — Analyze problem quality:
Is the problem statement specific enough for ${state.donor}?
Does it have statistics, numbers, percentages?
Is it aligned with ${state.donor} priorities?

TASK 2 — Analyze budget_breakdown:
Is the budget breakdown detailed enough?
Does USD ${state.budget} make sense for this topic and donor?
What is the acceptable per-beneficiary cost for ${state.donor}?

TASK 3 — Generate enhanced fields:
Generate ALL of these based on donor requirements:

Return in EXACTLY this format:

INPUT_QUALITY:
problem_score: [1-10]
budget_score: [1-10]
overall: [Weak/Average/Strong]
issues: [comma separated list of issues]

DONOR_PROFILE:
name: ${state.donor}
priorities: [what they fund]
terminology: [key words they use]
per_beneficiary_range: [min-max USD]
red_flags: [what they reject]

ENHANCED_PROBLEM:
[Rewrite or improve the problem statement with specific statistics, data, and ${state.donor} alignment. Keep user's original data but add WHO/UNICEF/World Bank context. 3-4 sentences minimum.]

ENHANCED_BUDGET_BREAKDOWN:
[Generate detailed budget breakdown for USD ${state.budget} aligned with ${state.donor} requirements. Include personnel, activities, training, MEAL, admin percentages with specific amounts.]

GENERATED_BENEFICIARIES:
[Generate realistic beneficiary breakdown: direct count, women%, men%, children, indirect count, vulnerability groups. Based on topic and region.]

GENERATED_SUSTAINABILITY:
[Generate 5-step sustainability plan aligned with ${state.donor} requirements. Include community ownership, government integration, exit strategy.]

INPUT_WARNINGS:
[List any red flags that ${state.donor} evaluators would flag. One per line.]
`

  const raw = await generateText(prompt, 2500)

  // Parse sections
  const qualityMatch      = raw.match(/INPUT_QUALITY:\n([\s\S]*?)(?=DONOR_PROFILE:)/)
  const donorMatch        = raw.match(/DONOR_PROFILE:\n([\s\S]*?)(?=ENHANCED_PROBLEM:)/)
  const problemMatch      = raw.match(/ENHANCED_PROBLEM:\n([\s\S]*?)(?=ENHANCED_BUDGET_BREAKDOWN:)/)
  const budgetMatch       = raw.match(/ENHANCED_BUDGET_BREAKDOWN:\n([\s\S]*?)(?=GENERATED_BENEFICIARIES:)/)
  const benefMatch        = raw.match(/GENERATED_BENEFICIARIES:\n([\s\S]*?)(?=GENERATED_SUSTAINABILITY:)/)
  const sustainMatch      = raw.match(/GENERATED_SUSTAINABILITY:\n([\s\S]*?)(?=INPUT_WARNINGS:)/)
  const warningsMatch     = raw.match(/INPUT_WARNINGS:\n([\s\S]*)/)

  // Parse input quality score
  const qualityText  = qualityMatch ? qualityMatch[1] : ''
  const overallMatch = qualityText.match(/overall:\s*(Weak|Average|Strong)/i)
  const issuesMatch  = qualityText.match(/issues:\s*(.+)/)
  const probScore    = qualityText.match(/problem_score:\s*(\d+)/)
  const budgScore    = qualityText.match(/budget_score:\s*(\d+)/)

  const inputQuality = {
    overall:       overallMatch  ? overallMatch[1]  : 'Average',
    issues:        issuesMatch   ? issuesMatch[1].split(',').map(s=>s.trim()) : [],
    problem_score: probScore     ? parseInt(probScore[1])  : 5,
    budget_score:  budgScore     ? parseInt(budgScore[1])  : 5,
  }

  // Use enhanced values — fallback to original if parse fails
  const enhancedProblem  = problemMatch  ? problemMatch[1].trim()  : state.problem
  const enhancedBudget   = budgetMatch   ? budgetMatch[1].trim()   : state.budget_breakdown || ''
  const generatedBenef   = benefMatch    ? benefMatch[1].trim()    : ''
  const generatedSustain = sustainMatch  ? sustainMatch[1].trim()  : ''
  const donorProfile     = donorMatch    ? donorMatch[1].trim()    : ''
  const warnings         = warningsMatch ? warningsMatch[1].trim() : ''

  return {
    // Enhanced inputs — overwrite weak user inputs
    problem:          enhancedProblem,
    budget_breakdown: enhancedBudget,
    beneficiaries:    generatedBenef   || state.beneficiaries || '',
    sustainability:   generatedSustain || '',

    // Metadata — for response
    _inputQuality:  inputQuality,
    _donorProfile:  donorProfile,
    _warnings:      warnings,
  }
}
