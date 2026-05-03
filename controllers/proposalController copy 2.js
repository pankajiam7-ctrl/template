import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

// ── LLM ─────────────────────────────
const llm = new ChatOpenAI({
  model: "gpt-4o",
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

  const res = await llm.invoke(prompt);
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

  // 🔥 STOP LOOP SAFETY
  if ((iteration || 0) >= 3) {
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
    "sustainability": []
  }
}
`;

  const res = await llm.invoke(prompt);

  return {
    ...state,
    outline: safeJSON(res.content),
  };
};

// ── FINAL NODES ─────────────────────
const goodEnd = async (state) => ({
  status: "GOOD",
  score: state.review?.score || 0,
  payload: state.payload,
  outline: state.outline,
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
    outline_data: null, // ✅ FIX: renamed (IMPORTANT)
    iteration: null,
    forceStop: null,
  },
});

graph.addNode("validate", validateNode);
graph.addNode("donor", donorNode);
graph.addNode("check", checkNode);
graph.addNode("improve", improveNode);
graph.addNode("outline", outlineNode);
graph.addNode("good_end", goodEnd);
graph.addNode("human_review", humanReview);

// FLOW
graph.setEntryPoint("validate");

graph.addEdge("validate", "donor");
graph.addEdge("donor", "check");

// 🔁 LOOP LOGIC
graph.addConditionalEdges("check", (state) => {
  const score = state.review?.score || 0;

  if (state.forceStop) return "human_review";

  return score >= 80 ? "outline" : "improve";
});

graph.addEdge("improve", "check");
graph.addEdge("outline", "good_end");

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
      score: result.review?.score || 0,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};