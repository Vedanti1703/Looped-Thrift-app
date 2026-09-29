const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')
dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4'])

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '.env'), override: true })

const app = express()

// Dynamic CORS configuration allowing process.env.FRONTEND_URL and localhost during development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true)
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true)
    }
    return callback(new Error('Blocked by CORS policy'))
  },
  credentials: true
}))

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

app.use('/auth', require('./routes/auth'))
app.use('/products', require('./routes/products'))
app.use('/user', require('./routes/user'))
app.use('/cart', require('./routes/cart'))
app.use('/ml', require('./routes/ml'))
app.use('/chat', require('./routes/chat'))
app.use('/upload', require('./routes/upload'))   // Cloudinary image uploads
app.use('/reviews', require('./routes/reviews'))
app.use('/rental', require('./routes/rental'))
app.use('/payment', require('./routes/payment'))
app.use('/collections', require('./routes/collections'))
app.use('/protection', require('./routes/orderProtection'))
app.use('/escrow', require('./routes/escrow'))
app.use('/style-me', require('./routes/styleMe'))
app.use('/bargain', require('./routes/bargain'))
app.use('/auction', require('./routes/auction'))
app.use('/listing', require('./routes/listing'))
app.use('/size', require('./routes/size'))
app.use("/", require("./routes/webhook"));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped'
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected')

    // Start background schedulers
    // 1. Bargain offer expiration (every hour)
    const { expireOldBargains } = require('./controllers/bargainController')
    setInterval(() => {
      expireOldBargains()
    }, 60 * 60 * 1000)

    // 2. Live Auction state machine transitions (every 60 seconds)
    const { settleAuction } = require('./controllers/auctionController')
    const Auction = require('./models/Auction')
    setInterval(async () => {
      try {
        const now = new Date()

        // Activate upcoming auctions whose start time has arrived (only if verified)
        await Auction.updateMany(
          { status: 'upcoming', verificationStatus: 'verified', startTime: { $lte: now } },
          { $set: { status: 'live' } }
        )

        // Mark auctions ending soon (within next 5 minutes)
        await Auction.updateMany(
          { status: 'live', verificationStatus: 'verified', endTime: { $lte: new Date(now.getTime() + 5 * 60 * 1000) } },
          { $set: { status: 'ending' } }
        )

        // Settle closed auctions that have ended
        const toSettle = await Auction.find({
          status: { $in: ['live', 'ending'] },
          endTime: { $lte: now }
        })
        for (const auction of toSettle) {
          await settleAuction(auction)
        }
      } catch (schErr) {
        console.error('Auction scheduler error:', schErr)
      }
    }, 60 * 1000)
  })
  .catch(err => console.log('❌ MongoDB error:', err))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Looped server running on port ${PORT}`))

