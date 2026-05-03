// server.js — Main entry point
import express        from 'express'
import cors           from 'cors'
import dotenv         from 'dotenv'
import connectDB      from './config/db.js'
import authRoutes     from './routes/authRoutes.js'
import proposalRoutes from './routes/proposalRoutes.js'
import { getProviderName } from './services/aiProvider.js'

dotenv.config()

// Connect MongoDB
connectDB()

const app = express()

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow all localhost ports (dev) + any origin from .env
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:3000',
    ].filter(Boolean)

    if (!origin || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ── Middleware ────────────────────────────────────────────────
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/proposals', proposalRoutes)

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status:   'ProposalAI Backend running',
    provider: getProviderName(),
    routes: {
      auth: {
        register:       'POST /api/auth/register',
        login:          'POST /api/auth/login',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword:  'POST /api/auth/reset-password/:token',
        changePassword: 'POST /api/auth/change-password',
        me:             'GET  /api/auth/me',
      },
      proposals: {
        generate: 'POST /api/proposals/generate',
        getAll:   'GET  /api/proposals',
        getOne:   'GET  /api/proposals/:id',
        delete:   'DELETE /api/proposals/:id',
      }
    }
  })
})

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 7777
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`AI Provider: ${getProviderName()}`)
})