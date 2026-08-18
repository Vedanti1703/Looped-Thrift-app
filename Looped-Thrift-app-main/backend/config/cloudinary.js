const cloudinary = require('cloudinary').v2
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Storage — uploads go to "looped-products" folder on Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'looped-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [
      { width: 800, height: 1000, crop: 'limit', quality: 'auto' }
    ],
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
})

module.exports = { cloudinary, upload }
