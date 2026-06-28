const router = require('express').Router()
const SavedListing = require('../models/SavedListing')
const { protect } = require('../middleware/auth')

router.use(protect)

// GET /api/saved — returns array of listing IDs
router.get('/', async (req, res) => {
  const saved = await SavedListing.find({ user: req.user._id }).select('listing').lean()
  res.json({ savedIds: saved.map((s) => s.listing.toString()) })
})

// POST /api/saved/:listingId
router.post('/:listingId', async (req, res) => {
  await SavedListing.findOneAndUpdate(
    { user: req.user._id, listing: req.params.listingId },
    { user: req.user._id, listing: req.params.listingId },
    { upsert: true }
  )
  res.status(201).json({ message: 'Saved' })
})

// DELETE /api/saved/:listingId
router.delete('/:listingId', async (req, res) => {
  await SavedListing.findOneAndDelete({ user: req.user._id, listing: req.params.listingId })
  res.json({ message: 'Removed from saved' })
})

module.exports = router
