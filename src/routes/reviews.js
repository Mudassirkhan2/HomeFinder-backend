const router = require('express').Router({ mergeParams: true })
const mongoose = require('mongoose')
const Review = require('../models/Review')
const Listing = require('../models/Listing')
const { protect } = require('../middleware/auth')

const DEFAULT_LIMIT = 10

function paginationParams(query) {
  const limit = Math.min(Math.max(parseInt(query.limit) || DEFAULT_LIMIT, 1), 50)
  const cursor = query.cursor || null
  return { limit, cursor }
}

/**
 * GET /api/listings/:listingId/reviews?limit=10&cursor=id
 * Also returns the caller's own review (if any) in `myReview` field
 * Returns: { reviews, hasMore, nextCursor, myReview }
 */
router.get('/', async (req, res) => {
  const { listingId } = req.params
  const { limit, cursor } = paginationParams(req.query)

  const filter = { listing: listingId }
  if (cursor && mongoose.isValidObjectId(cursor))
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }

  const reviews = await Review.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()

  const hasMore = reviews.length > limit
  if (hasMore) reviews.pop()

  // return the caller's own review separately so the frontend can show an edit form
  let myReview = null
  const authHeader = req.cookies?.token
  if (authHeader) {
    try {
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(authHeader, process.env.JWT_SECRET)
      myReview = await Review.findOne({ listing: listingId, user: decoded.id }).lean()
    } catch {}
  }

  res.json({
    reviews,
    hasMore,
    nextCursor: hasMore ? reviews[reviews.length - 1]._id.toString() : null,
    myReview,
  })
})

// POST /api/listings/:listingId/reviews  (upsert — one per user)
router.post('/', protect, async (req, res) => {
  const { rating, comment } = req.body
  if (!rating || !comment)
    return res.status(400).json({ message: 'Rating and comment are required' })
  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: 'Rating must be between 1 and 5' })

  const { listingId } = req.params
  if (!mongoose.isValidObjectId(listingId))
    return res.status(400).json({ message: 'Invalid listing ID' })

  const listing = await Listing.findById(listingId)
  if (!listing) return res.status(404).json({ message: 'Listing not found' })

  const review = await Review.findOneAndUpdate(
    { listing: listingId, user: req.user._id },
    {
      rating: Number(rating),
      comment: comment.trim(),
      userName: req.user.name,
      listing: listingId,
      user: req.user._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  await recalcStats(listing._id)
  res.status(201).json({ review })
})

// DELETE /api/listings/:listingId/reviews/:reviewId
router.delete('/:reviewId', protect, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.reviewId))
    return res.status(400).json({ message: 'Invalid review ID' })

  const review = await Review.findById(req.params.reviewId)
  if (!review) return res.status(404).json({ message: 'Review not found' })
  if (review.user.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Not authorized' })

  const listingId = review.listing
  await review.deleteOne()
  await recalcStats(listingId)

  res.json({ message: 'Review deleted' })
})

async function recalcStats(listingId) {
  const agg = await Review.aggregate([
    { $match: { listing: new mongoose.Types.ObjectId(listingId.toString()) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])
  const { avg = 0, count = 0 } = agg[0] || {}
  await Listing.findByIdAndUpdate(listingId, {
    avgRating: Math.round(avg * 10) / 10,
    reviewCount: count,
  })
}

module.exports = router
