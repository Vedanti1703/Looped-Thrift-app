# 🔁 Looped — Fashion Thrift Marketplace

A full-stack fashion thrift marketplace MVP built with React, Node.js, Express, and MongoDB.

---

## 🗂 Project Structure

```
looped/
├── frontend/          # React + Vite + Tailwind CSS
│   └── src/
│       ├── components/   # Reusable UI (cards, nav, header, spinner)
│       ├── context/      # AuthContext, CartContext (global state)
│       ├── pages/        # All route pages
│       ├── services/     # Axios API calls
│       └── utils/        # Formatting helpers
│
└── backend/           # Node.js + Express + MongoDB
    ├── controllers/   # Business logic
    ├── models/        # Mongoose schemas
    ├── routes/        # Express route definitions
    └── middleware/    # JWT auth middleware
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB running locally (`mongod`) OR a MongoDB Atlas URI
- Git

---

### 1. Clone / unzip the project

```bash
cd looped
```

---

### 2. Setup & run Backend

```bash
cd backend
npm install
```

Edit `.env` (already created):
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/looped
JWT_SECRET=looped_super_secret_change_in_production
```

Start the server:
```bash
npm run dev
# Server runs on http://localhost:5000
```

**Seed dummy data (run once):**
```bash
curl -X POST http://localhost:5000/products/admin/seed
# Seeds 30 sample products into MongoDB
```

---

### 3. Setup & run Frontend

```bash
cd ../frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

---

## 🔐 Authentication Flow

1. **Signup** at `/signup` → OTP sent (check backend console — always `123456` in dev)
2. **Verify OTP** at `/verify-otp` → enter `123456`
3. **Login** at `/login` with your email + password
4. JWT token stored in `localStorage`, auto-attached to all API calls

---

## 📱 App Pages & Routes

| Route           | Page                     | Description                            |
|-----------------|--------------------------|----------------------------------------|
| `/`             | Home                     | Sections: Recommended, Japan, Jaipur, London |
| `/discover`     | Discover                 | Search + filters + tag chips           |
| `/swipe`        | Swipe                    | Tinder-style card swipe                |
| `/product/:id`  | Product Detail           | Full info + Similar + Complete the Look |
| `/cart`         | Cart                     | Items, total, dummy checkout           |
| `/upload`       | Sell / Upload            | List a new item with tags              |
| `/profile`      | Profile                  | Liked, Listed, Seller Dashboard        |
| `/chat`         | Chat                     | Simulated conversations                |
| `/rent`         | Rent                     | Coming soon screen                     |
| `/auction`      | Auction                  | Coming soon screen                     |
| `/login`        | Login                    | Email + password                       |
| `/signup`       | Signup                   | Create account                         |
| `/verify-otp`   | OTP Verification         | 6-digit OTP entry                      |

---

## 🤖 AI Recommendation Logic (Rule-Based Tag Matching)

The recommendation system works in 3 steps:

### Step 1 — User likes an item (Swipe or Detail page)
```
POST /user/like  { productId }
```
→ Product's tags are merged into `user.likedTags` array in MongoDB

### Step 2 — Feed request includes userId
```
GET /products?userId=<id>
```
→ Backend scores each product: `score = count of tags that match user.likedTags`

### Step 3 — Products are sorted by score descending
```js
products.sort((a, b) => b.matchScore - a.matchScore)
```
→ Items matching the most liked tags appear first = personalised feed ✨

**Example:**
- User liked: Harajuku Jacket (tags: `japan`, `streetwear`, `jacket`)
- `user.likedTags = ["japan", "streetwear", "jacket"]`
- Product A has tags `["japan", "kimono"]` → score = 1
- Product B has tags `["japan", "streetwear", "vintage"]` → score = 2
- Product B ranks higher in the feed

---

## 🗄 Database Models

### User
```js
{ email, password (hashed), name, isVerified,
  otp, otpExpiry,                // for verification
  likedItems: [ObjectId],        // products user liked
  likedTags: [String],           // aggregated tags for recommendations
  uploadedItems: [ObjectId],     // products user listed
  soldItems: Number }
```

### Product
```js
{ title, price, originalPrice, condition, category,
  tags: [String],                // drives all search & recommendations
  image, images,
  sellerId, sellerName,
  views, likes, brand, size }
```

### Cart
```js
{ userId, items: [{ productId, title, price, image, condition }] }
```

---

## 🌐 API Endpoints

### Auth
```
POST /auth/signup        { email, password, name }
POST /auth/verify-otp   { userId, otp }
POST /auth/login         { email, password }
```

### Products
```
GET  /products           ?search= &tags= &category= &condition= &minPrice= &maxPrice= &userId=
GET  /products/:id       Returns { product, similar, completeTheLook }
POST /products           (auth) Create new product listing
POST /products/admin/seed  Seed 30 dummy products
```

### User
```
GET  /user/profile       (auth) Full profile with populated items
POST /user/like          (auth) { productId } — toggle like/unlike
```

### Cart
```
GET    /cart             (auth) Get user's cart
POST   /cart/add         (auth) { productId }
DELETE /cart/remove/:id  (auth) Remove item
```

---

## 🎨 Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | React 18, Vite, React Router v6     |
| Styling      | Tailwind CSS, DM Serif Display font |
| State        | React Context (Auth + Cart)         |
| HTTP Client  | Axios with interceptors             |
| Backend      | Node.js, Express 4                  |
| Database     | MongoDB with Mongoose ODM           |
| Auth         | JWT + bcryptjs + OTP (simulated)    |
| Images       | Unsplash URLs + Picsum (mock CDN)   |

---

## 🧪 Testing the App

1. Visit `http://localhost:3000`
2. Click **Sign Up** → enter email + password → use OTP `123456`
3. You'll land on **Home** with 4 thematic sections
4. Go to **Swipe** → like some items → go to **Home** — your recommendations update!
5. Open a product → **Add to Cart** → go to **Cart** → Checkout
6. Go to **Upload** to list your own item
7. Check **Profile → Dashboard** for seller analytics

---

## 📦 Extending This MVP

- **Real image upload**: Replace mock with Cloudinary multipart upload
- **Real OTP**: Integrate Twilio/SendGrid for email OTP
- **Payments**: Add Razorpay/Stripe checkout
- **Real-time chat**: Add Socket.io to the chat system
- **Search**: Add Elasticsearch or MongoDB Atlas Search for full-text
- **Push notifications**: Add Firebase Cloud Messaging

---

## 💡 Notes for Students

- OTP is always `123456` in dev — printed to backend console
- Images use Unsplash/Picsum URLs — no actual upload in MVP
- The recommendation engine is pure tag-matching — no ML needed
- All currency is in Indian Rupees (₹)
- The app is mobile-first, max-width 512px centered on desktop
