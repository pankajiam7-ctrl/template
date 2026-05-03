import { StateGraph } from "@langchain/langgraph";
import { EventEmitter } from "events";

import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

// Fix: 3 parallel LLM calls → multiple AbortSignal listeners → MaxListeners warning
EventEmitter.defaultMaxListeners = 20;

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
`.trim();

  const res = await llm.invoke(prompt, {
    max_tokens: 300, // donor profile ke liye 300 kaafi hai
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
`.trim();

  const res = await llm.invoke(prompt, { max_tokens: 500 });
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
`.trim();

  const res = await llm.invoke(prompt, { max_tokens: 800 });
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
`.trim();

  const res = await llm.invoke(prompt, { max_tokens: 1500 });

  return {
    ...state,
    outlineResult: safeJSON(res.content),
  };
};

// ── PROPOSAL NODE (3 parallel calls) ─────────────────────────────────────────
//
//  Node 1 — Core Narrative   : executive_summary, objectives, sustainability,
//                              monitoring_evaluation, budget        (~1,240 tok)
//  Node 2 — Plan & Alignment : activities, timeline, alignment_with_donor,
//                              implementation_strategy, target_beneficiaries (~1,251 tok)
//  Node 3 — Problem & Strategy: problem, outcomes, risk_analysis,
//                              innovation_or_approach               (~1,118 tok)
//
//  Total output: ~3,610 tokens  (was ~7,000 with proposal_html)
//  All 3 run in parallel → faster than single sequential call
// ─────────────────────────────────────────────────────────────────────────────

const buildBaseContext = (payload, donorProfile, outlineResult, review) => `
NGO INFO:
${JSON.stringify(payload)}

DONOR PROFILE:
${JSON.stringify(donorProfile)}

OUTLINE:
${JSON.stringify(outlineResult)}

REVIEW:
${JSON.stringify(review)}
`.trim();

// Fields jo array hone chahiye (frontend inhe list format mein dikhata hai)
const ARRAY_FIELDS = new Set([
  "objectives", "activities", "outcomes", "timeline",
]);

const buildPrompt = (donorProfile, context, fields) => {
  const formatField = (f) => {
    if (ARRAY_FIELDS.has(f)) {
      if (f === "timeline") {
        return `  "timeline": [
    { "phase": "Months 1-2", "task": "Activity description here" },
    { "phase": "Months 3-5", "task": "Next activity here" }
  ]`;
      }
      return `  "${f}": ["item 1", "item 2", "item 3"]`;
    }
    return `  "${f}": "Detailed paragraph text here"`;
  };

  return `
You are a world-class NGO proposal writer.
Write WINNING donor-ready content for these specific sections ONLY.

STRICT RULES:
- NO generic language
- Use real numbers and measurable outcomes
- Be donor-specific: ${donorProfile?.donor_name}
- Speak to priorities: ${JSON.stringify(donorProfile?.priorities)}
- For ARRAY fields: return a JSON array of strings, NOT a single string
- For timeline: return array of {phase, task} objects
- Each array item must be a complete standalone sentence

${context}

OUTPUT FORMAT (VERY IMPORTANT):
Return ONLY valid JSON with EXACTLY these fields and formats:

{
${fields.map((f) => formatField(f)).join(",\n")}
}
`.trim();
};

// Node 1 — Core Narrative
const proposalNode1 = async (state) => {
  const { outlineResult, payload, donorProfile, review } = state;
  const context = buildBaseContext(payload, donorProfile, outlineResult, review);
  const prompt = buildPrompt(donorProfile, context, [
    "executive_summary",
    "objectives",
    "sustainability",
    "monitoring_evaluation",
    "budget",
  ]);
  const res = await llm.invoke(prompt, { max_tokens: 1400 });
  return safeJSON(res.content);
};

// Node 2 — Plan & Alignment
const proposalNode2 = async (state) => {
  const { outlineResult, payload, donorProfile, review } = state;
  const context = buildBaseContext(payload, donorProfile, outlineResult, review);
  const prompt = buildPrompt(donorProfile, context, [
    "activities",
    "timeline",
    "alignment_with_donor",
    "implementation_strategy",
    "target_beneficiaries",
  ]);
  const res = await llm.invoke(prompt, { max_tokens: 1400 });
  return safeJSON(res.content);
};

// Node 3 — Problem & Strategy
const proposalNode3 = async (state) => {
  const { outlineResult, payload, donorProfile, review } = state;
  const context = buildBaseContext(payload, donorProfile, outlineResult, review);
  const prompt = buildPrompt(donorProfile, context, [
    "problem",
    "outcomes",
    "risk_analysis",
    "innovation_or_approach",
  ]);
  const res = await llm.invoke(prompt, { max_tokens: 1300 });
  return safeJSON(res.content);
};

// Main proposalNode — 3 parallel LLM calls
const proposalNode = async (state) => {
  const [part1, part2, part3] = await Promise.all([
    proposalNode1(state),
    proposalNode2(state),
    proposalNode3(state),
  ]);

  const proposal = { ...part1, ...part2, ...part3 };

  return {
    ...state,
    proposalResult: { proposal },
  };
};

// ── FINAL NODES ─────────────────────
const goodEnd = async (state) => ({
  status: "GOOD",
  score: state.review?.score || 0,
  payload: state.payload,
  outline: state.outlineResult,
  proposal: state.proposalResult,
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
    proposalResult: null,
    iteration: null,
    forceStop: null,
  },
});

graph.addNode("validate", validateNode);
graph.addNode("donor", donorNode);
graph.addNode("check", checkNode);
graph.addNode("improve", improveNode);
graph.addNode("outline", outlineNode);
graph.addNode("proposal", proposalNode);
graph.addNode("good_end", goodEnd);
graph.addNode("human_review", humanReview);

// ── FLOW ─────────────────────────────
graph.setEntryPoint("validate");

graph.addEdge("validate", "donor");
graph.addEdge("donor", "check");

graph.addConditionalEdges("check", (state) => {
  const score = state.review?.score || 0;
  if (score >= 80) return "outline";
  if (state.forceStop) return "human_review";
  return "improve";
});

graph.addEdge("improve", "check");
graph.addEdge("outline", "proposal");
graph.addEdge("proposal", "good_end");

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
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};