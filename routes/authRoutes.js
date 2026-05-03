// routes/authRoutes.js
import express from 'express'
import {
  register, login, forgotPassword,
  resetPassword, changePassword, getMe
} from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register',          register)
router.post('/login',             login)
router.post('/forgot-password',   forgotPassword)
router.post('/reset-password/:token', resetPassword)
router.post('/change-password',   protect, changePassword)  // login required
router.get('/me',                 protect, getMe)            // login required

export default router
