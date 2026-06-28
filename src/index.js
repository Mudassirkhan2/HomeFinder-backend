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

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
