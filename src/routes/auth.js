const router = require('express').Router()
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' })
}

const isProd = process.env.NODE_ENV === 'production'

function sendToken(res, user, statusCode) {
  const token = signToken(user._id)
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
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

router.post('/google', async (req, res) => {
  const { credential } = req.body
  if (!credential) return res.status(400).json({ message: 'No credential provided' })

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

  let ticket
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
  } catch {
    return res.status(401).json({ message: 'Invalid Google token' })
  }

  const { sub: googleId, email, name, picture } = ticket.getPayload()

  let user = await User.findOne({ googleId })
  if (!user) {
    user = await User.findOne({ email })
    if (user) {
      const updates = { googleId }
      if (picture) updates.photoURL = picture
      user = await User.findByIdAndUpdate(user._id, updates, { new: true })
    } else {
      user = await User.create({ name, email, googleId, photoURL: picture || undefined })
    }
  } else if (picture) {
    user = await User.findByIdAndUpdate(user._id, { photoURL: picture }, { new: true })
  }

  sendToken(res, user, 200)
})

router.post('/logout', (_, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  })
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
