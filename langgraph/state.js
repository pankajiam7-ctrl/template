// langgraph/state.js
export const proposalState = {
  // ── User inputs ───────────────────────────────────
  topic:            { value: (a, b) => b ?? a, default: () => '' },
  ngo_name:         { value: (a, b) => b ?? a, default: () => '' },
  region:           { value: (a, b) => b ?? a, default: () => '' },
  budget:           { value: (a, b) => b ?? a, default: () => '500000' },
  duration:         { value: (a, b) => b ?? a, default: () => '24' },
  language:         { value: (a, b) => b ?? a, default: () => 'English' },
  donor:            { value: (a, b) => b ?? a, default: () => '' },
  problem:          { value: (a, b) => b ?? a, default: () => '' },
  beneficiaries:    { value: (a, b) => b ?? a, default: () => '' },
  budget_breakdown: { value: (a, b) => b ?? a, default: () => '' },
  sustainability:   { value: (a, b) => b ?? a, default: () => '' },

  // ── Node 0 output ─────────────────────────────────
  _inputQuality:    { value: (a, b) => b ?? a, default: () => ({}) },
  _donorProfile:    { value: (a, b) => b ?? a, default: () => '' },
  _warnings:        { value: (a, b) => b ?? a, default: () => '' },

  // ── Internal budget ───────────────────────────────
  _budget:          { value: (a, b) => b ?? a, default: () => ({}) },
  _inputQA:         { value: (a, b) => b ?? a, default: () => ({}) },

  // ── Node 1 output ─────────────────────────────────
  outline:          { value: (a, b) => b ?? a, default: () => '' },

  // ── Node 2 output ─────────────────────────────────
  proposal:         { value: (a, b) => b ?? a, default: () => '' },

  // ── Node 3 output ─────────────────────────────────
  score:            { value: (a, b) => b ?? a, default: () => 0 },
  feedback:         { value: (a, b) => b ?? a, default: () => '' },
  breakdown:        { value: (a, b) => b ?? a, default: () => ({}) },

  // ── Node 3.5 output ───────────────────────────────
  consistency:      { value: (a, b) => b ?? a, default: () => ({}) },

  // ── Node 4 output ─────────────────────────────────
  generic_check:    { value: (a, b) => b ?? a, default: () => ({}) },
}
