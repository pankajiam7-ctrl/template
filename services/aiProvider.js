// services/aiProvider.js
import dotenv from 'dotenv'
dotenv.config()

import OpenAI from 'openai'

const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
})

export const generateText = async (prompt, maxTokens = 4000) => {
  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  })
  return res.choices[0].message.content
}

export const getProviderName = () => 'openai'


// // services/aiProvider.js
// // ─────────────────────────────────────────────────────────────
// // Swap AI provider by changing AI_PROVIDER in .env
// // AI_PROVIDER=anthropic  →  Claude
// // AI_PROVIDER=openai     →  GPT-4o
// // ─────────────────────────────────────────────────────────────
// import dotenv from 'dotenv'
// dotenv.config()

// const PROVIDER = process.env.AI_PROVIDER || 'anthropic'

// // ── Anthropic client ─────────────────────────────────────────
// let anthropicClient = null
// const getAnthropic = async () => {
//   if (!anthropicClient) {
//     const { default: Anthropic } = await import('@anthropic-ai/sdk')
//     anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
//   }
//   return anthropicClient
// }

// // ── OpenAI client ────────────────────────────────────────────
// let openaiClient = null
// const getOpenAI = async () => {
//   if (!openaiClient) {
//     const { default: OpenAI } = await import('openai')
//     openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
//   }
//   return openaiClient
// }

// // ── Main function — call this in all LangGraph nodes ─────────
// export const generateText = async (prompt, maxTokens = 4000) => {
//   if (PROVIDER === 'openai') {
//     const client = await getOpenAI()
//     const res = await client.chat.completions.create({
//       model: 'gpt-4o',
//       max_tokens: maxTokens,
//       messages: [{ role: 'user', content: prompt }]
//     })
//     return res.choices[0].message.content

//   } else {
//     // Default: Anthropic
//     const client = await getAnthropic()
//     const res = await client.messages.create({
//       model: 'claude-sonnet-4-5-20251001',
//       max_tokens: maxTokens,
//       messages: [{ role: 'user', content: prompt }]
//     })
//     return res.content[0].text
//   }
// }

// export const getProviderName = () => PROVIDER
