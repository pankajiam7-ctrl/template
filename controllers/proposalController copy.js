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

// ── SAFE JSON ─────────────────────────
const safeJSON = (text) => {
  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch {
    return { raw: text };
  }
};

// ── NODE 1: VALIDATION ─────────────────
const validateNode = async (state) => {
  const payload = state.payload;

  const requiredFields = [
    "topic",
    "ngo_name",
    "region",
    "focus",
    "budget",
    "duration",
    "language",
    "donor",
    "problem",
    "budget_breakdown",
  ];

  const errors = requiredFields
    .filter((f) => payload[f] === undefined || payload[f] === null)
    .map((f) => `${f} missing`);

  return { ...state, errors: errors.length ? errors : null };
};

// ── NODE 2: DONOR ─────────────────────
const donorNode = async (state) => {
  if (state.errors) return state;

  const { payload } = state;

  const prompt = `
You are an NGO donor research expert.

Donor: ${payload.donor}
Topic: ${payload.topic}
Region: ${JSON.stringify(payload.region)}
Focus: ${JSON.stringify(payload.focus)}

Return ONLY JSON:

{
  "donor_name": "",
  "priorities": [],
  "focus_areas": [],
  "typical_grant_size": "",
  "preferred_regions": [],
  "key_requirements": []
}
`;

  const res = await llm.invoke(prompt);

  return {
    ...state,
    donorProfile: safeJSON(res.content),
  };
};

// ── NODE 3: REVIEW ─────────────────────
const checkNode = async (state) => {
  if (state.errors) return state;

  const { payload, donorProfile } = state;

  const prompt = `
You are an NGO proposal reviewer.

INPUT:
${JSON.stringify(payload)}

DONOR:
${JSON.stringify(donorProfile)}

Focus, region, and budget_breakdown are ARRAYS.

Return ONLY JSON:

{
  "status": "OK" | "IMPROVE",
  "score": number,

  "issues": [],

  "suggestions": {
    "focus": "",
    "problem": "",
    "budget": ""
  },

  "improved_version": {
    "focus": [],
    "region": [],
    "problem": "",
    "budget_breakdown": []
  },

  "message_to_user": ""
}
`;

  const res = await llm.invoke(prompt);

  return {
    ...state,
    review: safeJSON(res.content),
  };
};

// ── GRAPH ─────────────────────────────
const graph = new StateGraph({
  channels: {
    payload: null,
    errors: null,
    donorProfile: null,
    review: null,
  },
});

graph.addNode("validate", validateNode);
graph.addNode("donor", donorNode);
graph.addNode("check", checkNode);

// ── END NODES ─────────────────────────
graph.addNode("good_end", async (state) => {
  return {
    status: "GOOD",
    message: "Proposal ready",
    donor_profile: state.donorProfile,
    analysis: state.review,
  };
});

graph.addNode("human_review", async (state) => {
  return {
    status: "IMPROVE",
    message: "Needs improvements",

    issues: state.review?.issues || [],
    suggestions: state.review?.suggestions || {},
    improved_version: state.review?.improved_version || {},
  };
});

// ── FLOW ─────────────────────────────
graph.setEntryPoint("validate");

graph.addEdge("validate", "donor");
graph.addEdge("donor", "check");

// decision
graph.addConditionalEdges("check", (state) => {
  return state.review?.status === "OK"
    ? "good_end"
    : "human_review";
});

const app = graph.compile();

// ── API ───────────────────────────────
export const generateProposal = async (req, res) => {
  try {
    const result = await app.invoke({
      payload: req.body,
    });

    if (result.errors) {
      return res.status(400).json({
        node: "node1",
        status: "FAIL",
        errors: result.errors,
      });
    }

    return res.status(200).json({
      node: result.status === "GOOD" ? "good_end" : "human_review",
      status: result.status,
      data: result,
    });

  } catch (err) {
    return res.status(500).json({
      status: "FAIL",
      error: err.message,
    });
  }
};