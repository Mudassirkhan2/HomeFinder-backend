require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const listingRoutes = require('./routes/listings')
const reviewRoutes = require('./routes/reviews')
const savedRoutes = require('./routes/saved')

const app = express()

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5000')
  .split(',').map((o) => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, origin || '*')
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/listings/:listingId/reviews', reviewRoutes)
app.use('/api/saved', savedRoutes)

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  res.status(status).json({ message: err.message || 'Internal server error' })
})

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    const PORT = process.env.PORT || 5000
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
