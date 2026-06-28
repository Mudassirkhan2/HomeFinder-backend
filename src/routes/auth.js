const router = require('express').Router()
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' })
}

function sendToken(res, user, statusCode) {
  const token = signToken(user._id)
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
  res.status(statusCode).json({ user })
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password)
    return res.status(400).json({ message: 'All fields are required' })

  const exists = await User.findOne({ email })
  if (exists) return res.status(409).json({ message: 'Email already registered' })

  const user = await User.create({ name, email, password })
  sendToken(res, user, 201)
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ email })
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid email or password' })

  sendToken(res, user, 200)
})

router.post('/logout', (_, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

router.get('/me', protect, (req, res) => {
  res.json({ user: req.user })
})

router.put('/me', protect, async (req, res) => {
  const { name, email } = req.body
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, email },
    { new: true, runValidators: true }
  )
  res.json({ user })
})

router.put('/me/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = await User.findById(req.user._id)
  if (!(await user.comparePassword(currentPassword)))
    return res.status(401).json({ message: 'Current password is incorrect' })

  user.password = newPassword
  await user.save()
  res.json({ message: 'Password updated' })
})

module.exports = router
