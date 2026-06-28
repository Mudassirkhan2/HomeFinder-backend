const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true },
  photoURL: { type: String },
}, { timestamps: true })

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.set('toJSON', {
  transform: (_, obj) => { delete obj.password; return obj }
})

module.exports = mongoose.model('User', userSchema)
