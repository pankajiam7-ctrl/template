// models/User.js
import mongoose from 'mongoose'
import bcrypt   from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  plan: { type: String, enum: ['free', 'pro', 'team'], default: 'free' },
  proposalsUsed: { type: Number, default: 0 },
  resetPasswordToken:   String,
  resetPasswordExpires: Date,
}, { timestamps: true })

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password
userSchema.methods.comparePassword = async function (entered) {
  return bcrypt.compare(entered, this.password)
}

export default mongoose.model('User', userSchema)
