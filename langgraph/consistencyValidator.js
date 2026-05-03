// langgraph/consistencyValidator.js
// NODE 3.5 — Cross-check engine
// Validates math consistency before final score

export const validateConsistency = async (state) => {

  const b           = state._budget || {}
  const proposal    = state.proposal || ''
  const errors      = []
  const warnings    = []
  let   scorePenalty = 0

  // ── 1. Extract numbers from proposal sections ───────────────
  const allNumbers = [...proposal.matchAll(/[\d,]+(?:\.\d+)?/g)]
    .map(m => parseInt(m[0].replace(/,/g, '')))
    .filter(n => n > 0)

  // ── 2. Beneficiary cross-check ──────────────────────────────
  const benefNum     = b.benefNum || 10000
  const benefMatches = [...proposal.matchAll(/(\d[\d,]*)\s*(direct\s*beneficiar|beneficiar)/gi)]
    .map(m => parseInt(m[1].replace(/,/g, '')))
    .filter(n => n > 100)

  const uniqueBenefNums = [...new Set(benefMatches)]
  if (uniqueBenefNums.length > 1) {
    const diff = Math.max(...uniqueBenefNums) - Math.min(...uniqueBenefNums)
    if (diff > benefNum * 0.1) {
      errors.push(`Beneficiary mismatch: found ${uniqueBenefNums.join(' vs ')} across sections — should be ${benefNum} throughout`)
      scorePenalty += 6
    }
  }

  // ── 3. Budget cross-check ───────────────────────────────────
  const totalBudget  = b.total || 500000
  const budgetMatches = [...proposal.matchAll(/USD\s*([\d,]+)/gi)]
    .map(m => parseInt(m[1].replace(/,/g, '')))
    .filter(n => n > 10000 && n <= totalBudget * 1.05)

  const totalMentions = budgetMatches.filter(n => Math.abs(n - totalBudget) < totalBudget * 0.02)
  if (totalMentions.length === 0) {
    warnings.push(`Total budget USD ${totalBudget} not consistently mentioned`)
    scorePenalty += 2
  }

  // ── 4. Beneficiary breakdown sum check ──────────────────────
  const womenMatch    = proposal.match(/women[^.]*?(\d[\d,]*)/i)
  const menMatch      = proposal.match(/men[^.]*?(\d[\d,]*)/i)
  const childrenMatch = proposal.match(/children[^.]*?(\d[\d,]*)/i)

  if (womenMatch && menMatch && childrenMatch) {
    const women    = parseInt(womenMatch[1].replace(/,/g, ''))
    const men      = parseInt(menMatch[1].replace(/,/g, ''))
    const children = parseInt(childrenMatch[1].replace(/,/g, ''))

    if (women + men > benefNum * 1.15) {
      errors.push(`Breakdown sum error: women ${women} + men ${men} = ${women+men} exceeds total ${benefNum}`)
      scorePenalty += 4
    }
    if (children > benefNum) {
      errors.push(`Children ${children} exceeds total beneficiaries ${benefNum}`)
      scorePenalty += 3
    }
  }

  // ── 5. Percentage checks ────────────────────────────────────
  const pctMatches = [...proposal.matchAll(/(\d+)%/g)]
    .map(m => parseInt(m[1]))
    .filter(n => n > 0 && n <= 100)

  const over100 = pctMatches.filter(n => n > 100)
  if (over100.length > 0) {
    errors.push(`Invalid percentage found: ${over100.join(', ')}% — percentages cannot exceed 100`)
    scorePenalty += 2
  }

  // ── 6. Timeline feasibility ─────────────────────────────────
  const duration = parseInt(state.duration) || 24
  const monthMatches = [...proposal.matchAll(/Month\s*(\d+)/gi)]
    .map(m => parseInt(m[1]))

  const invalidMonths = monthMatches.filter(m => m > duration + 1)
  if (invalidMonths.length > 0) {
    warnings.push(`Timeline references Month ${Math.max(...invalidMonths)} but project is only ${duration} months`)
    scorePenalty += 2
  }

  // ── 7. Sustainability realism check ─────────────────────────
  if (proposal.match(/100%\s*(cost recovery|sustainability|self.sustain)/i)) {
    warnings.push('100% cost recovery claim within project period is unrealistic for donors')
    scorePenalty += 1
  }

  // ── 8. AI-precision red flags ───────────────────────────────
  const precisionFlags = [
    /\d+\.\d+%\s*(improvement|increase|reduction)/gi,
    /exactly\s+\d+%/gi,
    /precisely\s+\d+/gi,
  ]
  precisionFlags.forEach(flag => {
    if (proposal.match(flag)) {
      warnings.push('Over-precise percentages detected — donors may flag as fabricated')
      scorePenalty += 1
    }
  })

  scorePenalty = Math.min(scorePenalty, 20)

  return {
    consistency: {
      errors,
      warnings,
      score_penalty: scorePenalty,
      passed: errors.length === 0,
      summary: errors.length === 0
        ? `No critical errors. ${warnings.length} warnings. Penalty: -${scorePenalty} points.`
        : `${errors.length} errors found. ${warnings.length} warnings. Penalty: -${scorePenalty} points.`
    }
  }
}
