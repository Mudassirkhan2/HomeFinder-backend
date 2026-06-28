const router = require('express').Router()
const mongoose = require('mongoose')
const SavedListing = require('../models/SavedListing')
const Listing = require('../models/Listing')
const { protect } = require('../middleware/auth')

router.use(protect)

/**
 * GET /api/saved?limit=12&cursor=id&full=true
 * full=true  → returns populated listing docs (for the Saved page grid)
 * full=false → returns just listing IDs (for heart-icon state across the app)
 */
router.get('/', async (req, res) => {
  const full = req.query.full === 'true'
  const limit = Math.min(parseInt(req.query.limit) || 12, 40)
  const cursor = req.query.cursor || null

  const filter = { user: req.user._id }
  if (cursor && mongoose.isValidObjectId(cursor))
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }

  if (!full) {
    // lightweight — just IDs for the entire saved set (no cursor, no limit)
    const saved = await SavedListing.find({ user: req.user._id }).select('listing').lean()
    return res.json({ savedIds: saved.map((s) => s.listing.toString()) })
  }

  const savedDocs = await SavedListing.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()

  const hasMore = savedDocs.length > limit
  if (hasMore) savedDocs.pop()

  const listingIds = savedDocs.map((s) => s.listing)
  const listings = await Listing.find({ _id: { $in: listingIds } }).lean()

  // preserve order (newest saved first)
  const listingMap = Object.fromEntries(listings.map((l) => [l._id.toString(), l]))
  const ordered = listingIds.map((id) => listingMap[id.toString()]).filter(Boolean)

  res.json({
    listings: ordered,
    hasMore,
    nextCursor: hasMore ? savedDocs[savedDocs.length - 1]._id.toString() : null,
  })
})

// POST /api/saved/:listingId
router.post('/:listingId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId))
    return res.status(400).json({ message: 'Invalid listing ID' })

  await SavedListing.findOneAndUpdate(
    { user: req.user._id, listing: req.params.listingId },
    { user: req.user._id, listing: req.params.listingId },
    { upsert: true }
  )
  res.status(201).json({ message: 'Saved' })
})

// DELETE /api/saved/:listingId
router.delete('/:listingId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId))
    return res.status(400).json({ message: 'Invalid listing ID' })

  await SavedListing.findOneAndDelete({ user: req.user._id, listing: req.params.listingId })
  res.json({ message: 'Removed from saved' })
})

module.exports = router
