// models/Proposal.js
import mongoose from 'mongoose'

const proposalSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:    { type: String, required: true },
  ngo_name: { type: String, required: true },
  region:   String,
  budget:   String,
  duration: String,
  language: { type: String, default: 'English' },
  donor:    String,
  outline:  String,
  proposal: String,
  score:    { type: Number, default: 0 },
  feedback: String,
  breakdown: {
    clarity:     Number,
    feasibility: Number,
    impact:      Number,
    budget_fit:  Number,
    grade:       String,
    strengths:   [String],
    weaknesses:  [String],
  },
  status: { type: String, enum: ['draft', 'complete'], default: 'complete' },
}, { timestamps: true })

export default mongoose.model('Proposal', proposalSchema)
