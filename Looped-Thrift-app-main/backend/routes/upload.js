// upload.js — uploads images to Cloudinary
// Returns permanent URLs like https://res.cloudinary.com/yourcloud/image/upload/...

const router     = require('express').Router()
const multer     = require('multer')
const cloudinary = require('cloudinary').v2
const auth       = require('../middleware/auth')

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Use memory storage — file goes to RAM, then we push to Cloudinary
// This avoids saving anything to disk on the server
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype)
    ok ? cb(null, true) : cb(new Error('Only image files allowed'))
  },
})

// Helper: upload buffer to Cloudinary and return URL
function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:   'looped-products',
        public_id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        transformation: [
          { width: 800, height: 1000, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
        ],
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result.secure_url) // https:// URL — works everywhere forever
      }
    )
    stream.end(buffer)
  })
}

// POST /upload/image — single image
router.post('/image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' })
    const url = await uploadToCloudinary(req.file.buffer, req.file.originalname)
    res.json({ url })
  } catch (err) {
    console.error('Cloudinary upload error:', err.message)
    res.status(500).json({ message: 'Image upload failed: ' + err.message })
  }
})

// POST /upload/images — up to 4 images (4-step photo flow)
router.post('/images', auth, upload.fields([
  { name: 'image_0', maxCount: 1 },
  { name: 'image_1', maxCount: 1 },
  { name: 'image_2', maxCount: 1 },
  { name: 'image_3', maxCount: 1 },
]), async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No images provided' })
    }

    const urls = {}
    // Upload all images in parallel
    await Promise.all(
      Object.entries(req.files).map(async ([key, fileArr]) => {
        const url  = await uploadToCloudinary(fileArr[0].buffer, fileArr[0].originalname)
        urls[key]  = { url }
      })
    )

    res.json({ urls })
  } catch (err) {
    console.error('Cloudinary multi-upload error:', err.message)
    res.status(500).json({ message: 'Image upload failed: ' + err.message })
  }
})

module.exports = router
