const multer = require('multer')
const cloudinary = require('../utils/cloudinary')

class CloudinaryStorage {
  constructor({ cloudinary: client, params }) {
    this.client = client
    this.params = params
  }

  _handleFile(req, file, cb) {
    const params = typeof this.params === 'function' ? this.params(req, file) : this.params
    const uploadStream = this.client.uploader.upload_stream(params, (error, result) => {
      if (error) return cb(error)
      cb(null, {
        fieldname: file.fieldname,
        originalname: file.originalname,
        path: result.secure_url,
        filename: result.public_id,
        size: result.bytes,
        mimetype: file.mimetype,
      })
    })
    file.stream.pipe(uploadStream)
  }

  _removeFile(req, file, cb) {
    if (file.filename) {
      this.client.uploader.destroy(file.filename, cb)
    } else {
      cb(null)
    }
  }
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'homefinder/listings',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1280, height: 960, crop: 'limit', quality: 'auto' }],
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

module.exports = upload
