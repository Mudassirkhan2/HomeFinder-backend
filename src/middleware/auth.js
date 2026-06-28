const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function protect(req, res, next) {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ message: 'Not authenticated' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')
    if (!req.user) return res.status(401).json({ message: 'User not found' })
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = { protect }
