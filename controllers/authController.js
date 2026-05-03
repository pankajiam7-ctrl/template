// controllers/authController.js
import jwt        from 'jsonwebtoken'
import crypto     from 'crypto'
import nodemailer from 'nodemailer'
import User       from '../models/User.js'

// ── JWT token generator ──────────────────────────────────────
const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
})

// ── Email transporter ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, password required' })

    const exists = await User.findOne({ email })
    if (exists) return res.status(400).json({ error: 'Email already registered' })

    const user = await User.create({ name, email, password })
    const token = signToken(user._id)

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' })

    const user = await User.findOne({ email })
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid email or password' })

    const token = signToken(user._id)

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })

    // Always return success — don't reveal if email exists
    if (!user) return res.json({ success: true, message: 'Reset email sent if account exists' })

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken   = crypto.createHash('sha256').update(resetToken).digest('hex')
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000 // 30 minutes
    await user.save({ validateBeforeSave: false })

    // Send email
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to:   user.email,
      subject: 'ProposalAI — Password Reset',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password. Link expires in 30 minutes.</p>
        <a href="${resetURL}" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Reset Password
        </a>
        <p style="margin-top:16px;color:#888">If you didn't request this, ignore this email.</p>
      `
    })

    res.json({ success: true, message: 'Reset email sent if account exists' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/reset-password/:token
// ─────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex')

    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    })

    if (!user) return res.status(400).json({ error: 'Token invalid or expired' })

    user.password             = req.body.password
    user.resetPasswordToken   = undefined
    user.resetPasswordExpires = undefined
    await user.save()

    const token = signToken(user._id)
    res.json({ success: true, token, message: 'Password reset successful' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/change-password   (logged in user)
// ─────────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.user._id)

    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ error: 'Current password is incorrect' })

    user.password = newPassword
    await user.save()

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me   (get current user)
// ─────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  res.json({ success: true, user: req.user })
}
