const mongoose = require('mongoose')

const savedListingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
}, { timestamps: true })

savedListingSchema.index({ user: 1, listing: 1 }, { unique: true })

module.exports = mongoose.model('SavedListing', savedListingSchema)
