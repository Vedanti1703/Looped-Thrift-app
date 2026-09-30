# 🚀 Looped Full-Stack Deployment Guide

This guide covers step-by-step instructions for deploying the **Looped** fashion thrift marketplace ecosystem:
- **Database**: MongoDB Atlas (with Vector Search Index `product_vector_index`)
- **Backend**: Render Web Service (Node.js/Express)
- **ML Service**: Render Web Service (Python Flask + scikit-learn price prediction)
- **Frontend**: Vercel (React 18 + Vite SPA)
- **Mobile & Local Testing**: Same Wi-Fi network testing on a smartphone (390px+ viewport)

---

## 1. MongoDB Atlas Setup

### A. Create Cluster & Database
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Create a free **M0 Sandbox** cluster (e.g. in `aws-ap-south-1` Mumbai or nearest region).
3. Under **Database Access**, create a database user:
   - Authentication Method: **Password**
   - Username: `looped_admin`
   - Password: `<generate-a-secure-password>`
   - Database User Privileges: `Read and write to any database`
4. Under **Network Access**, click **Add IP Address**:
   - Choose **Allow Access from Anywhere** (`0.0.0.0/0`) so Render and local test instances can connect.
5. Click **Connect** → **Drivers (Node.js)** → Copy your connection string:
   ```env
   mongodb+srv://looped_admin:<password>@cluster0.xxxx.mongodb.net/looped?retryWrites=true&w=majority
   ```

### B. Create MongoDB Atlas Vector Search Index
Looped uses MongoDB Atlas Vector Search for natural language and visual image search.
1. In MongoDB Atlas, go to **Atlas Search** (or **Search** tab inside your cluster).
2. Click **Create Search Index** → Select **Atlas Vector Search** (JSON Editor).
3. Target Database: `looped`, Collection: `products`.
4. Set **Index Name** to:
   ```
   product_vector_index
   ```
5. Paste the following index definition JSON:
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 1536,
         "similarity": "cosine"
       }
     ]
   }
   ```
6. Click **Next** → **Create Vector Search Index**. Wait 1-2 minutes until status becomes **Active**.

### C. Run Database Seed Scripts
From your local `Looped-Thrift-app-main/backend` directory:
```bash
cd backend
npm install

# 1. Sync & insert synthetic 1,000 fashion products
node scripts/syncAllProductsToDB.js

# 2. Seed the demo seller user and assign sellerId to all products
npm run seed:seller

# 3. Seed live, ending soon, and upcoming auctions
npm run seed:auctions

# 4. Generate OpenAI vector embeddings for products (requires OPENAI_API_KEY in backend/.env)
node scripts/embedProducts.js
```

---

## 2. Render Deployment (Backend & ML Service)

Render can deploy both backend and ML microservices automatically using the included `render.yaml` Blueprint or manual setup.

### Option A: Automatic Blueprint Deployment (Recommended)
1. Push your code to your GitHub repository on branch `asees-kd` (or merge to `main`).
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository.
5. Render reads `render.yaml` and provisions both services:
   - `looped-backend` (Node Web Service)
   - `looped-ml-service` (Python Web Service)
6. Fill in the required environment variables in the Render Dashboard when prompted:
   - `MONGO_URI`: Your MongoDB Atlas URI
   - `JWT_SECRET`: A long random secret string
   - `OPENAI_API_KEY`: `sk-proj-...`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `FRONTEND_URL`: (Will be set to your Vercel URL in Step 3)

### Option B: Manual Service Creation on Render

#### Service 1: `looped-ml-service`
1. Click **New +** → **Web Service** → Connect your repo.
2. Configuration:
   - **Name**: `looped-ml-service`
   - **Root Directory**: `ml-service`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Health Check Path**: `/health`
3. Environment Variables:
   - `PYTHON_VERSION`: `3.11.8`
4. Click **Create Web Service**. Note the deployed URL (e.g. `https://looped-ml-service.onrender.com`).

#### Service 2: `looped-backend`
1. Click **New +** → **Web Service** → Connect your repo.
2. Configuration:
   - **Name**: `looped-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
3. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGO_URI`: `<Your MongoDB Atlas URI>`
   - `JWT_SECRET`: `<Your JWT Secret>`
   - `ML_SERVICE_URL`: `https://looped-ml-service.onrender.com`
   - `FRONTEND_URL`: `https://<your-app>.vercel.app` (update once frontend is deployed)
   - `OPENAI_API_KEY`: `sk-proj-...`
   - `OPENAI_MODEL`: `gpt-4o-mini`
   - `CLOUDINARY_CLOUD_NAME`: `<your_cloud_name>`
   - `CLOUDINARY_API_KEY`: `<your_api_key>`
   - `CLOUDINARY_API_SECRET`: `<your_api_secret>`
   - `RAZORPAY_KEY_ID`: `<your_key_id>`
   - `RAZORPAY_KEY_SECRET`: `<your_key_secret>`
4. Click **Create Web Service**. Note the backend URL (e.g. `https://looped-backend.onrender.com`).

---

## 3. Vercel Deployment (Frontend)

1. Log in to [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** → **Project** → Import your GitHub repository.
3. Configure Project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Add Environment Variable:
   - `VITE_API_URL` = `https://looped-backend.onrender.com` (Your Render backend URL)
5. Click **Deploy**.
6. Once deployed, copy your Vercel deployment URL (e.g. `https://looped-thrift.vercel.app`), go back to your Render `looped-backend` service settings, and set `FRONTEND_URL` to this Vercel URL to finalize CORS.

---

## 4. Testing Locally on Your Smartphone (Same Wi-Fi)

To test the mobile-first coquette thrift UI on your actual phone (iPhone / Android) over local Wi-Fi:

### Step 1: Find your Laptop's Local IP Address
- **Windows (PowerShell)**:
  ```powershell
  ipconfig
  ```
  Look for **IPv4 Address** under your Wi-Fi adapter (e.g., `192.168.1.147` or `192.168.0.105`).
- **Mac / Linux**:
  ```bash
  ifconfig | grep "inet "
  ```

### Step 2: Configure Environment for Local Phone Testing
1. In `frontend/.env`:
   ```env
   VITE_API_URL=http://<YOUR-LAPTOP-IP>:5000
   ```
   *(Example: `VITE_API_URL=http://192.168.1.147:5000`)*

2. In `backend/.env`:
   ```env
   PORT=5000
   FRONTEND_URL=http://<YOUR-LAPTOP-IP>:5173
   ```

### Step 3: Start the Servers
- **Terminal 1 (Backend)**:
  ```bash
  cd backend
  npm run dev
  ```
- **Terminal 2 (Frontend with Host Binding)**:
  ```bash
  cd frontend
  npm run dev -- --host 0.0.0.0
  ```
- **Terminal 3 (ML Service)**:
  ```bash
  cd ml-service
  python app.py
  ```

### Step 4: Open on Your Phone
1. Connect your phone to the **same Wi-Fi network** as your laptop.
2. Open Safari / Chrome on your phone and navigate to:
   ```
   http://<YOUR-LAPTOP-IP>:5173
   ```
   *(Example: `http://192.168.1.147:5173`)*

---

## 5. Mobile Responsiveness & Viewport Checklist

- **Viewport Meta Tag**: `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` is set in `index.html`.
- **Minimum Width Check (390px - iPhone 12/13/14/15/16)**:
  - App shell is wrapped in a responsive container (`max-w-lg mx-auto`).
  - No horizontal scrolling occurs on any route (`overflow-x-hidden`).
  - Fixed `BottomNav` includes safe-area padding (`env(safe-area-inset-bottom)`) and never covers buttons or content due to bottom spacing (`pb-28` to `pb-32` on pages).
  - Modals (Bargain, Rental, Size, Collections) are full-width cards with backdrop blurs optimized for touch interaction.

---

## 6. Verification Checklist

| Feature | Verification Step |
|---|---|
| **Health Checks** | `GET /health` on backend and ML service returns `200 OK`. |
| **Bargaining** | Buyer submits offer from Product Detail → Seller responds in My Offers / Dashboard → Counter offer accept/decline. |
| **Auctions** | `/auction` shows Live, Ending Soon, Upcoming, and My Drops tabs. `/auction/create` launches new drop. Detail page updates countdown and live bids with anti-snipe. |
| **Visual Search & CV** | Upload photo in Sell or Search → Handled via backend `/products/search-visual` (no exposed API keys). |
| **ML Price Model** | Upload form fetches smart price range based on brand, category, condition, and original price. |
| **Rent & Escrow** | Escrow release / buyer protection flow with timeline and dispute escalation. |
