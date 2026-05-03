import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

// ── LLM ─────────────────────────────
const llm = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0.3,
  apiKey: process.env.OPENAI_API_KEY,
});

// ── SAFE JSON ───────────────────────
const safeJSON = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return { error: "JSON_PARSE_FAIL" };
  }
};

// ── NORMALIZERS ─────────────────────
const normalizeArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") return [v];
  return [];
};

const normalizeString = (v, fallback = "Not provided") =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;

// ── VALIDATE NODE ───────────────────
const validateNode = async (state) => {
  const p = state.payload || {};

  return {
    ...state,
    iteration: state.iteration ?? 0,
    forceStop: false,

    payload: {
      topic: normalizeString(p.topic),
      ngo_name: normalizeString(p.ngo_name),
      region: normalizeArray(p.region),
      focus: normalizeArray(p.focus),
      budget: p.budget || "0",
      duration: p.duration || "12",
      language: p.language || "English",
      donor: normalizeString(p.donor, "Unknown"),
      problem: normalizeString(p.problem),
      budget_breakdown: normalizeArray(p.budget_breakdown),
    },
  };
};

// ── DONOR NODE ──────────────────────
const donorNode = async (state) => {
  const { payload } = state;

  const prompt = `
Analyze donor.

Donor: ${payload.donor}

Return JSON:
{
  "donor_name": "",
  "category": "",
  "priorities": [],
  "focus_areas": [],
  "confidence": 0.0
}
`;

  const res = await llm.invoke(prompt, {
    max_tokens: 7000,   // 🔥 output bada karega
  });
  const parsed = safeJSON(res.content);

  return {
    ...state,
    donorProfile: parsed?.error
      ? {
        donor_name: "Generic Donor",
        category: "development",
        priorities: [],
        focus_areas: [],
        confidence: 0.3,
      }
      : parsed,
  };
};

// ── CHECK NODE ──────────────────────
const checkNode = async (state) => {
  const { payload, donorProfile } = state;

  const prompt = `
Strict NGO evaluator.

Score based on:
- alignment 30%
- outcomes 25%
- clarity 20%
- budget 15%
- credibility 10%

INPUT:
${JSON.stringify(payload)}

DONOR:
${JSON.stringify(donorProfile)}

Return JSON:
{
  "score": number,
  "issues": [],
  "suggestions": {}
}
`;

  const res = await llm.invoke(prompt);
  const parsed = safeJSON(res.content);

  return {
    ...state,
    review: {
      score: parsed?.score || 0,
      issues: parsed?.issues || [],
      suggestions: parsed?.suggestions || {},
    },
  };
};

// ── IMPROVE NODE ────────────────────
const improveNode = async (state) => {
  const { payload, review, iteration } = state;

  // 🔥 STOP LOOP SAFETY — 2 tak improve, phir forceStop
  if ((iteration || 0) >= 2) {
    return { ...state, forceStop: true };
  }

  const prompt = `
Improve NGO proposal.

INPUT:
${JSON.stringify(payload)}

SUGGESTIONS:
${JSON.stringify(review.suggestions)}

Return ONLY full improved JSON.
`;

  const res = await llm.invoke(prompt);
  const improved = safeJSON(res.content);

  const newPayload = improved?.error
    ? payload
    : {
      ...payload,
      ...Object.fromEntries(
        Object.entries(improved).filter(([_, v]) => v !== undefined)
      ),
    };

  return {
    ...state,
    payload: newPayload,
    iteration: (iteration || 0) + 1,
  };
};

// ── OUTLINE NODE ────────────────────
const outlineNode = async (state) => {
  const { payload, donorProfile } = state;

  const prompt = `
Create NGO proposal OUTLINE.

INPUT:
${JSON.stringify(payload)}

DONOR:
${JSON.stringify(donorProfile)}

Return JSON:
{
  "core": {
    "executive_summary": [],
    "problem": [],
    "objectives": [],
    "activities": [],
    "outcomes": [],
    "timeline": [],
    "budget": [],
    "risk_analysis": [],
    "sustainability": [],
    "alignment_with_donor": [],
    "target_beneficiaries": [],
    "implementation_strategy": [],
    "monitoring_evaluation": [],
    "innovation_or_approach": []
  }
}
`;

  const res = await llm.invoke(prompt);

  return {
    ...state,
    outlineResult: safeJSON(res.content),
  };
};

// ── PROPOSAL NODE ────────────────────
// const proposalNode = async (state) => {
//   const { outlineResult, payload, donorProfile, review } = state;

//   const prompt = `
// You are a world-class NGO proposal writer who has helped organizations win millions in funding.

// Your job is to write a WINNING, fully detailed proposal that will compel ${donorProfile?.donor_name} to fund this project.

// STRICT RULES:
// - NO generic language. Every sentence must be specific to this project, region, and donor.
// - Use real numbers, percentages, and measurable targets from the data provided.
// - Write as if lives depend on this proposal being funded — because they do.
// - Speak directly to ${donorProfile?.donor_name}'s priorities: ${JSON.stringify(donorProfile?.priorities)}.
// - Each section must be detailed, persuasive, and evidence-based.
// - Do NOT use filler phrases like "this project aims to" or "we will strive to".
// - Use active, confident language: "We will", "This project delivers", "Communities will receive".

// NGO INFO:
// ${JSON.stringify(payload)}

// DONOR PROFILE:
// ${JSON.stringify(donorProfile)}

// OUTLINE TO EXPAND:
// ${JSON.stringify(outlineResult)}

// REVIEW SCORE & SUGGESTIONS:
// ${JSON.stringify(review)}

// Write each section as a full, rich, professional narrative. Be specific. Be bold. Be winning.

// Return JSON:
// {
//   "proposal": {
//     "executive_summary": "2-3 compelling paragraphs...",
//     "problem": "Detailed problem statement with regional data and statistics...",
//     "objectives": "3-5 specific SMART objectives with targets...",
//     "activities": "Detailed activity plan with who, what, when, where...",
//     "outcomes": "Specific measurable outcomes with numbers and timelines...",
//     "timeline": "Month-by-month implementation plan...",
//     "budget": "Detailed budget narrative justifying each cost...",
//     "risk_analysis": "Key risks with specific mitigation strategies...",
//     "sustainability": "Concrete plan for project continuation after funding ends...",
//     "alignment_with_donor": "Specific alignment with donor priorities and goals...",
//     "target_beneficiaries": "Who benefits, how many, demographic breakdown...",
//     "implementation_strategy": "Step-by-step execution plan with responsibilities...",
//     "monitoring_evaluation": "KPIs, data collection methods, reporting schedule...",
//     "innovation_or_approach": "What makes this proposal unique and impactful..."
//   }
// }
// `;

//   const res = await llm.invoke(prompt);

//   return {
//     ...state,
//     proposalResult: safeJSON(res.content),
//   };
// };
const proposalNode = async (state) => {
  const { outlineResult, payload, donorProfile, review } = state;

  const prompt = `
You are a world-class NGO proposal writer.

Write a WINNING donor-ready proposal.

STRICT RULES:
- NO generic language
- Use real numbers and measurable outcomes
- Be donor-specific: ${donorProfile?.donor_name}
- Speak to priorities: ${JSON.stringify(donorProfile?.priorities)}

NGO INFO:
${JSON.stringify(payload)}

DONOR PROFILE:
${JSON.stringify(donorProfile)}

OUTLINE:
${JSON.stringify(outlineResult)}

REVIEW:
${JSON.stringify(review)}

OUTPUT FORMAT (VERY IMPORTANT):
Return ONLY valid JSON:

{
  "proposal": {
    "executive_summary": "",
    "problem": "",
    "objectives": "",
    "activities": "",
    "outcomes": "",
    "timeline": "",
    "budget": "",
    "risk_analysis": "",
    "sustainability": "",
    "alignment_with_donor": "",
    "target_beneficiaries": "",
    "implementation_strategy": "",
    "monitoring_evaluation": "",
    "innovation_or_approach": ""
  },
  "proposal_html": "<!DOCTYPE html><html><head><style>body{font-family:Arial;padding:20px}</style></head><body>...</body></html>"
}
`;

  const res = await llm.invoke(prompt);

  return {
    ...state,
    proposalResult: safeJSON(res.content),
  };
};

// const proposalNode = async (state) => {
//   const { outlineResult, payload, donorProfile, review } = state;

//   const prompt = `
// You are a world-class NGO proposal writer who creates high-impact funding proposals.

// Your job is to convert the given structured data into a FULLY DESIGNED HTML PROPOSAL DOCUMENT.

// STRICT RULES:
// - NO JSON output
// - Output ONLY valid HTML
// - Must be print-ready (A4 style)
// - Must look like a professional donor proposal
// - Use clear headings, sections, bullet points
// - Be specific, data-driven, persuasive
// - Speak directly to ${donorProfile?.donor_name}'s priorities: ${JSON.stringify(donorProfile?.priorities)}

// NGO INFO:
// ${JSON.stringify(payload)}

// DONOR PROFILE:
// ${JSON.stringify(donorProfile)}

// OUTLINE:
// ${JSON.stringify(outlineResult)}

// REVIEW:
// ${JSON.stringify(review)}

// HTML REQUIREMENTS:
// - Include full document structure (<!DOCTYPE html>)
// - Add inline CSS for professional styling
// - Sections must include:
//   Executive Summary
//   Problem
//   Objectives
//   Activities
//   Outcomes
//   Timeline
//   Budget
//   Risk Analysis
//   Sustainability
//   Monitoring & Evaluation
//   Innovation

// Make it visually clean, structured, and donor-ready.

// Return ONLY HTML.
// `;

//   const res = await llm.invoke(prompt);

//   return {
//     ...state,
//     proposalHtml: res.content,   // 👈 now HTML directly
//   };
// };
// ── FINAL NODES ─────────────────────
const goodEnd = async (state) => ({
  status: "GOOD",
  score: state.review?.score || 0,
  payload: state.payload,
  outline: state.outlineResult,
  proposal: state.proposalResult,          // ✅ proposal add
});

const humanReview = async (state) => ({
  status: "IMPROVE",
  score: state.review?.score || 0,
  issues: state.review?.issues || [],
  suggestions: state.review?.suggestions || {},
});

// ── GRAPH ────────────────────────────
const graph = new StateGraph({
  channels: {
    payload: null,
    donorProfile: null,
    review: null,
    outlineResult: null,
    proposalResult: null,                  // ✅ channel add
    iteration: null,
    forceStop: null,
  },
});

graph.addNode("validate", validateNode);
graph.addNode("donor", donorNode);
graph.addNode("check", checkNode);
graph.addNode("improve", improveNode);
graph.addNode("outline", outlineNode);
graph.addNode("proposal", proposalNode);   // ✅ node add
graph.addNode("good_end", goodEnd);
graph.addNode("human_review", humanReview);

// FLOW
graph.setEntryPoint("validate");

graph.addEdge("validate", "donor");
graph.addEdge("donor", "check");

// 🔁 LOOP LOGIC
graph.addConditionalEdges("check", (state) => {
  const score = state.review?.score || 0;

  if (score >= 80) return "outline";
  if (state.forceStop) return "human_review";

  return "improve";
});

graph.addEdge("improve", "check");
graph.addEdge("outline", "proposal");      // ✅ outline → proposal
graph.addEdge("proposal", "good_end");     // ✅ proposal → good_end

const app = graph.compile();

// ── API ─────────────────────────────
export const generateProposal = async (req, res) => {
  try {
    const result = await app.invoke({
      payload: req.body,
      iteration: 0,
      forceStop: false,
    });

    return res.json({
      status: result.status,
      score: result.score || result.review?.score || 0,
      outline: result.outline || null,
      // proposal: result.proposal || null,   // ✅ proposal response me
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};