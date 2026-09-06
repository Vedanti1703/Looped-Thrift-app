const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')
dns.setServers(['8.8.8.8', '8.8.4.4'])

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '.env'), override: true })

const app = express()
app.use(cors())
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

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
app.use("/", require("./routes/webhook"));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped'
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Looped server running on port ${PORT}`))
