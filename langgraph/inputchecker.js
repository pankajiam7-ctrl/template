// controllers/inputChecker.js
// Checks user input quality — NO AI, instant
// Returns: { score, grade, tips, isStrong }

const CONFIG = {
    minProblemWords: 8,
    minDurationMonths: 6,
    minBudgetBreakdownChars: 5,
    deduct: {
        problemTooShort: 25,
        noNumbers: 25,
        noPercentages: 5,
        noBudgetBreakdown: 10,
        durationTooShort: 5,
    },
    grade: {
        strong: 80,
        average: 55,
    },
    isStrongThreshold: 60,
}

export const checkInputQuality = (body) => {
    const { duration, problem, budget_breakdown } = body
    const tips = []
    let score = 100

    const words = (problem || '').trim().split(' ').filter(Boolean)
    const hasNumbers = /\d+/.test(problem || '')
    const hasPct = /\d+%/.test(problem || '')

    if (words.length < CONFIG.minProblemWords) {
        score -= CONFIG.deduct.problemTooShort
        tips.push({
            field: 'problem',
            issue: `Problem statement is too short — only ${words.length} words`,
            fix: 'Write 2-3 sentences with real statistics and community data',
        })
    }

    if (!hasNumbers) {
        score -= CONFIG.deduct.noNumbers
        tips.push({
            field: 'problem',
            issue: 'No numbers or statistics in problem statement',
            fix: 'Add percentages, counts, distances, or death rates',
        })
    }

    if (hasNumbers && !hasPct) {
        score -= CONFIG.deduct.noPercentages
        tips.push({
            field: 'problem',
            issue: 'No percentages found',
            fix: 'Add percentage values alongside absolute numbers',
        })
    }

    if (!budget_breakdown || budget_breakdown.trim().length < CONFIG.minBudgetBreakdownChars) {
        score -= CONFIG.deduct.noBudgetBreakdown
        tips.push({
            field: 'budget_breakdown',
            issue: 'Budget breakdown is missing',
            fix: 'Provide breakdown: personnel, activities, training, MEAL, admin',
        })
    }

    if (!duration || parseInt(duration) < CONFIG.minDurationMonths) {
        score -= CONFIG.deduct.durationTooShort
        tips.push({
            field: 'duration',
            issue: 'Project duration is too short',
            fix: `Minimum ${CONFIG.minDurationMonths} months — donors prefer 12-24 months`,
        })
    }

    const grade = score >= CONFIG.grade.strong ? 'Strong'
        : score >= CONFIG.grade.average ? 'Average'
            : 'Weak'
    const isStrong = score >= CONFIG.isStrongThreshold

    return { score, grade, tips, isStrong }
}