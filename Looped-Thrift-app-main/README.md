# 🔁 Looped — AI-Powered Fashion Thrift Marketplace & Ecosystem

Looped is a full-stack, mobile-first sustainable fashion marketplace designed with a curated coquette aesthetic. It integrates conversational AI, vector search, microservices-based machine learning price estimation, live auctions with anti-sniping protection, direct peer-to-peer price bargaining, rental management, an escrow buyer protection timeline, size intelligence, and gamified circular fashion carbon tracking.

---

## 🌟 Core Features & Systems

### 1. 🔨 Live Vintage Drops & Real-Time Auctions
- **State Machine**: Automatic live updates across `upcoming`, `live`, `ending`, `settled`, and `closed` states via periodic backend schedulers.
- **Real-Time Bidding**: In-memory queue-based bid serialization prevents race conditions and concurrent write conflicts with optimistic concurrency control (`__v`).
- **⚡ Anti-Snipe Protection**: Bids placed in the final 5 minutes automatically extend auction duration by 2 minutes.
- **Creator Dashboard**: Start drops at `/auction/create` with custom starting price, reserve price, bid increment step, and scheduled drop windows.
- **Curated Tabs**: Filter by `All Drops`, `Live Now 🔴`, `Ending Soon 🔥`, `Upcoming ⏳`, and personal `My Drops & Bids 🙋‍♀️`.

### 2. 🏷️ Real-Time P2P Price Bargaining
- **Direct Negotiation**: Buyers propose custom offer prices (validated at minimum 30% of listing price) with custom notes.
- **Seller Counters & Acceptance**: Sellers can accept, counter with a specific price, or decline offers. Buyers can instantly accept seller counters.
- **Auto-Expiration**: Active offers automatically expire after 48 hours via background jobs.

### 3. 👗 Peer-to-Peer Clothing Rentals
- **Rent Instead of Buying**: Rent curated designer pieces by day with automatic duration calculations and refundable security deposits.
- **Rental Lifecycle Management**: Request, accept, ship, receive, return, and confirm items with dispute escalation mechanisms.

### 4. 🤖 AI Visual Search & Computer Vision Quality Inspector
- **Multimodal Visual Search**: Upload or capture clothing photos to find similar aesthetic matches using OpenAI GPT-4o Vision and MongoDB Atlas Vector Search (`product_vector_index`).
- **Photo Quality & Damage Detector**: Automated CV checks for fabric texture close-ups, on-model framing, stain/wear warnings, and auto-generated fashion tags — routed securely through backend microservices without exposing client API keys.

### 5. 🧠 ML Price Prediction Microservice
- **Python Flask Microservice**: 7-feature regression model (`scikit-learn 1.3.2`) trained on brand tiers, condition scores, logarithmic original pricing, and category encodings.
- **Smart Price Guidance**: Provides recommended resale price ranges and confidence scores to sellers during upload.

### 6. 🔒 Buyer Protection, Escrow & Return System
- **Escrow Fund Protection**: Buyer payments are safely held in escrow until the item is delivered and inspected.
- **Visual Status Stepper**: 6-stage interactive timeline tracking (`Order Placed → Shipped → Out for Delivery → Delivered → 48hr Inspection Window → Payout Released`).
- **Dispute Resolution**: Multi-step return and condition problem reporting with admin resolution console (`/admin/disputes`).

### 7. 📏 Size Intelligence & Body Measurement Fitting
- **Personal Size Passport**: Store exact body measurements (chest, waist, hips, inseam, shoulder, foot length).
- **Delta Fit Comparison**: Compares personal measurements with garment dimensions to provide fit ratings (e.g., "True to size", "Slightly snug on chest", "Relaxed fit").

### 8. 🌿 Circular Carbon & Sustainability Tracker
- **Gamified Eco Impact**: Automatically computes CO₂ savings (kg), water conserved (litres), and circulated garment counts per purchase.
- **Growth Tiers**: Badges upgrade across `Seedling → Sprout → Leaf → Tree → Forest Guardian`.

### 9. ✨ Style Me AI & Smart Chat
- **In-App LLM Fashion Stylist**: Chat with Looped AI for style advice, complete-the-look recommendations, and vintage outfit coordination.

---

## 🗂 Project Architecture

```
Looped-Thrift-app/
├── frontend/                  # React 18 + Vite + Tailwind CSS (Coquette Pastel UI)
│   ├── src/
│   │   ├── components/        # Reusable UI (Header, BottomNav, BargainModal, SizeMeasurements, etc.)
│   │   ├── context/           # AuthContext, CartContext
│   │   ├── pages/             # HomePage, DiscoverPage, AuctionPage, CreateAuctionPage, StyleMePage, etc.
│   │   ├── services/          # Axios API clients (api.js, auctionService, bargainService, etc.)
│   │   └── utils/             # Formatters, currency & date helpers
│   └── vercel.json            # SPA rewrite routing for Vercel
│
├── backend/                   # Node.js + Express + MongoDB / Mongoose
│   ├── controllers/           # Business logic (auctionController, bargainController, loopedAiController, etc.)
│   ├── models/                # Schemas (Product, Auction, Bargain, User, Order, Rental, etc.)
│   ├── routes/                # Express REST routes (/auction, /bargain, /products, /rental, etc.)
│   ├── services/              # Visual search, OpenAI embeddings, escrow handlers
│   └── scripts/               # Seed scripts (seedDemoSeller.js, seedAuctions.js, embedProducts.js, etc.)
│
└── ml-service/                # Python 3.11 Flask Microservice
    ├── app.py                 # REST API endpoints (/predict, /health, /metrics)
    ├── train_model.py         # 7-feature scikit-learn price training pipeline
    └── model/                 # Serialized pickle artifacts (price_model.pkl, encoders.pkl)
```

---

## 📱 App Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Home | Curated feed (Personalized recommendations, Harajuku Japan, Jaipur heritage, London archive) |
| `/discover` | Discover | Multimodal visual search, tag filters, natural language query |
| `/swipe` | Swipe Feed | Tinder-style thrift discovery with real-time preference learning |
| `/product/:id` | Product Detail | Item showcase, Bargain modal, Rent option, Similar items, Complete-the-look |
| `/auction` | Live Auctions | Real-time drop countdowns, anti-snipe bidding, active/ending/upcoming tabs |
| `/auction/create` | Start Auction | Launch live drops with custom start/reserve prices and schedules |
| `/auction/:id` | Auction Detail | Live countdown, real-time bid queue, bid history, outbid alerts |
| `/rent` | Rental Hub | Available designer wardrobe pieces for short-term rental |
| `/style-me` | Style Me | AI wardrobe builder and aesthetic coordinator |
| `/cart` | Cart & Checkout | Order summary, escrow protection badge, Razorpay payment |
| `/my-orders` | My Orders | Escrow protection tracking timeline, dispute & return requests |
| `/seller-dashboard` | Seller Portal | Shipped orders, tracking entry, return approvals, payout status |
| `/profile` | User Profile | Liked items, Listed items, My Offers (Bargains), Eco Impact stats, Size Profile, Collections |
| `/upload` | Sell & Upload | Multi-angle photo upload with CV checker and ML price suggester |
| `/chat` | Chat & In-App AI | Peer-to-peer chats and Looped Stylist AI assistant |

---

## 🚀 Local Development Setup

### 1. Backend (Node.js)
```bash
cd backend
npm install
npm run dev
# Server running on http://localhost:5000
```

**Seed Database Data:**
```bash
# Seed demo seller and associate missing product seller IDs
npm run seed:seller

# Seed live, ending soon, and upcoming auctions
npm run seed:auctions
```

### 2. ML Price Prediction Service (Python)
```bash
cd ml-service
pip install -r requirements.txt
python app.py
# ML Microservice running on http://localhost:5001
```

### 3. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

---

## ☁️ Production Deployment

Refer to [`DEPLOY.md`](./DEPLOY.md) for full production deployment instructions covering **MongoDB Atlas** (with Vector Search Index `product_vector_index`), **Render** (Node.js backend and Python ML microservice via `render.yaml`), **Vercel** (React Vite frontend with SPA routing), and same Wi-Fi mobile testing.
