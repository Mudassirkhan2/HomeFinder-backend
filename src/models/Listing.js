const mongoose = require('mongoose')

const listingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['rent', 'sale'], required: true },
  propertyType: { type: String, enum: ['house', 'apartment', 'villa', 'plot', 'pg'], required: true },
  name: { type: String, required: true, trim: true },
  bedrooms: { type: Number, required: true, min: 1 },
  bathrooms: { type: Number, required: true, min: 1 },
  area: { type: Number, required: true, min: 100 },
  parking: { type: Boolean, default: false },
  furnished: { type: Boolean, default: false },
  address: { type: String, required: true },
  description: { type: String, required: true },
  phone: { type: String, required: true },
  offer: { type: Boolean, default: false },
  regularprice: { type: Number, required: true },
  discountedprice: { type: Number },
  imgUrls: [{ type: String }],
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
}, { timestamps: true })

listingSchema.index({ type: 1, createdAt: -1 })
listingSchema.index({ offer: 1, createdAt: -1 })

module.exports = mongoose.model('Listing', listingSchema)
