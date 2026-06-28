const router = require('express').Router()
const mongoose = require('mongoose')
const Listing = require('../models/Listing')
const { protect } = require('../middleware/auth')
const upload = require('../middleware/upload')
const cloudinary = require('../utils/cloudinary')

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 40

function parseBool(val) {
  if (val === 'true' || val === true) return true
  if (val === 'false' || val === false) return false
  return undefined
}

function coerceBooleans(data) {
  ;['offer', 'parking', 'furnished'].forEach((k) => {
    if (data[k] !== undefined) data[k] = parseBool(data[k]) ?? false
  })
}

function paginationParams(query) {
  const limit = Math.min(Math.max(parseInt(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const cursor = query.cursor || null
  return { limit, cursor }
}

function buildCursorFilter(cursor) {
  if (!cursor || !mongoose.isValidObjectId(cursor)) return {}
  return { _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
}

function paginatedResponse(docs, limit) {
  const hasMore = docs.length > limit
  if (hasMore) docs.pop()
  return {
    hasMore,
    nextCursor: hasMore ? docs[docs.length - 1]._id.toString() : null,
  }
}

/**
 * GET /api/listings
 * Query: type, offer, propertyType, minPrice, maxPrice, minBeds, furnished, limit, cursor
 * Returns: { listings, hasMore, nextCursor }
 */
router.get('/', async (req, res) => {
  const { type, offer, propertyType, minPrice, maxPrice, minBeds, furnished } = req.query
  const { limit, cursor } = paginationParams(req.query)

  const filter = { ...buildCursorFilter(cursor) }
  if (type) filter.type = type
  if (offer === 'true') filter.offer = true
  if (propertyType) filter.propertyType = propertyType
  if (minPrice || maxPrice) {
    filter.regularprice = {}
    if (minPrice) filter.regularprice.$gte = Number(minPrice)
    if (maxPrice) filter.regularprice.$lte = Number(maxPrice)
  }
  if (minBeds) filter.bedrooms = { $gte: Number(minBeds) }
  if (furnished === 'true') filter.furnished = true

  const listings = await Listing.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()

  const pagination = paginatedResponse(listings, limit)
  res.json({ listings, ...pagination })
})

/**
 * GET /api/listings/search?q=text&type=rent|sale&limit=8&cursor=id
 * Returns: { listings, hasMore, nextCursor }
 */
router.get('/search', async (req, res) => {
  const { q, type, propertyType } = req.query
  if (!q?.trim()) return res.json({ listings: [], hasMore: false, nextCursor: null })

  const { limit, cursor } = paginationParams(req.query)

  const filter = {
    ...buildCursorFilter(cursor),
    $or: [
      { name: { $regex: q.trim(), $options: 'i' } },
      { address: { $regex: q.trim(), $options: 'i' } },
      { description: { $regex: q.trim(), $options: 'i' } },
    ],
  }
  if (type) filter.type = type
  if (propertyType) filter.propertyType = propertyType

  const listings = await Listing.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()

  const pagination = paginatedResponse(listings, limit)
  res.json({ listings, ...pagination })
})

/**
 * GET /api/listings/mine?limit=8&cursor=id
 * Current user's own listings, paginated
 */
router.get('/mine', protect, async (req, res) => {
  const { limit, cursor } = paginationParams(req.query)
  const filter = { owner: req.user._id, ...buildCursorFilter(cursor) }

  const listings = await Listing.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()

  const pagination = paginatedResponse(listings, limit)
  res.json({ listings, ...pagination })
})

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: 'Invalid listing ID' })

  const listing = await Listing.findById(req.params.id)
    .populate('owner', 'name email')
    .lean()
  if (!listing) return res.status(404).json({ message: 'Listing not found' })
  res.json({ listing })
})

// POST /api/listings
router.post('/', protect, upload.array('images', 6), async (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ message: 'At least one image is required' })

  const data = { ...req.body, imgUrls: req.files.map((f) => f.path), owner: req.user._id }
  coerceBooleans(data)

  const listing = await Listing.create(data)
  res.status(201).json({ listing })
})

// PUT /api/listings/:id
router.put('/:id', protect, upload.array('images', 6), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: 'Invalid listing ID' })

  const listing = await Listing.findById(req.params.id)
  if (!listing) return res.status(404).json({ message: 'Listing not found' })
  if (listing.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Not authorized' })

  const data = { ...req.body }
  if (req.files?.length) data.imgUrls = [...listing.imgUrls, ...req.files.map((f) => f.path)]
  coerceBooleans(data)

  const updated = await Listing.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  })
  res.json({ listing: updated })
})

// DELETE /api/listings/:id/images  — remove one image from Cloudinary + listing
router.delete('/:id/images', protect, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: 'Invalid listing ID' })

  const { imageUrl } = req.body
  if (!imageUrl) return res.status(400).json({ message: 'imageUrl is required' })

  const listing = await Listing.findById(req.params.id)
  if (!listing) return res.status(404).json({ message: 'Listing not found' })
  if (listing.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Not authorized' })

  if (!listing.imgUrls.includes(imageUrl))
    return res.status(400).json({ message: 'Image not found on this listing' })

  // Extract Cloudinary public_id from URL
  // URL shape: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>.<ext>
  const uploadIndex = imageUrl.indexOf('/upload/')
  if (uploadIndex !== -1) {
    const afterUpload = imageUrl.slice(uploadIndex + 8)
    const withoutVersion = afterUpload.replace(/^v\d+\//, '')
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '')
    await cloudinary.uploader.destroy(publicId)
  }

  await Listing.findByIdAndUpdate(req.params.id, { $pull: { imgUrls: imageUrl } })
  const updated = await Listing.findById(req.params.id)
  res.json({ listing: updated })
})

// DELETE /api/listings/:id
router.delete('/:id', protect, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: 'Invalid listing ID' })

  const listing = await Listing.findById(req.params.id)
  if (!listing) return res.status(404).json({ message: 'Listing not found' })
  if (listing.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Not authorized' })

  await listing.deleteOne()
  res.json({ message: 'Listing deleted' })
})

module.exports = router
