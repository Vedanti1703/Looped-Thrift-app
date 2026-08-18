// ─────────────────────────────────────────────────────────────
//  UploadPage.jsx  —  full seller listing flow
//  Phase 1: Multi-step photo upload with CV validation
//  Phase 2: Listing details form
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhotoUploadStep from '../components/PhotoUploadStep'
import Spinner from '../components/Spinner'
import PriceSuggestion from '../components/PriceSuggestion'
import { createProduct } from '../services/productService'
import { uploadMultipleImages } from '../services/uploadService'
import { useAuth } from '../context/AuthContext'

const CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved']
const CATEGORIES = [
  "Women's Tops", "Women's Bottoms", "Women's Outerwear", "Women's Traditional",
  "Men's Tops", "Men's Outerwear", "Men's Bottoms",
  "Accessories", "Footwear", "Bags", "Jewelry", "Women's Sets"
]

const PHOTO_STEPS = [
  { step: 1, label: 'Front View',     required: true  },
  { step: 2, label: 'Back View',      required: true  },
  { step: 3, label: 'Fabric Closeup', required: true  },
  { step: 4, label: 'On-Model Shot',  required: false },
]

export default function UploadPage() {
  const navigate = useNavigate()
  const { user, token, refreshUser } = useAuth()

  const [phase, setPhase] = useState('photos')
  const [currentPhotoStep, setCurrentPhotoStep] = useState(1)
  const [completedPhotos, setCompletedPhotos]   = useState({})
  const [allAutoTags, setAllAutoTags] = useState([])

  const [form, setForm] = useState({
    title: '', price: '', originalPrice: '', description: '',
    condition: 'Like New', category: "Women's Tops",
    tags: '', brand: '', size: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  if (!token) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center pb-24 text-center px-6">
      <p className="text-4xl mb-3">🔒</p>
      <p className="font-semibold text-gray-700 mb-4">Sign in to sell on Looped</p>
      <button onClick={() => navigate('/login')} className="btn-primary max-w-xs">Sign In</button>
    </div>
  )

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handlePhotoComplete = (stepNum, data) => {
    const updated = { ...completedPhotos, [stepNum]: data }
    setCompletedPhotos(updated)
    if (data.autoTags?.length > 0) {
      setAllAutoTags(prev => [...new Set([...prev, ...data.autoTags])])
    }
    if (stepNum < 4) {
      setCurrentPhotoStep(stepNum + 1)
    } else {
      goToDetails(updated)
    }
  }

  const handlePhotoSkip = () => goToDetails(completedPhotos)

  const goToDetails = (photos) => {
    setForm(f => ({ ...f, tags: allAutoTags.join(', ') }))
    setPhase('details')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.price) return setError('Title and price are required')
    setError('')
    setLoading(true)
    try {
      // ── Step 1: Upload photos to Cloudinary ────────────────
      // This sends the actual File objects to backend → Cloudinary
      // Returns permanent URLs like https://res.cloudinary.com/...
      setError('Uploading photos…')
      let imageUrl     = `https://picsum.photos/seed/${encodeURIComponent(form.title)}/400/500`
      let allImageUrls = []

      const hasRealFiles = Object.values(completedPhotos).some(p => p?.file instanceof File)
      if (hasRealFiles) {
        const uploaded = await uploadMultipleImages(completedPhotos)
        if (uploaded.length > 0) {
          allImageUrls = uploaded
          imageUrl     = uploaded[0]   // first photo = main listing image
        }
      }
      setError('')

      // ── Step 2: Save product to MongoDB with Cloudinary URLs ─
      const userTags = form.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      await createProduct({
        ...form,
        price:         Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        image:         imageUrl,        // permanent Cloudinary URL
        images:        allImageUrls,    // all 4 photos
        tags:          [...new Set(userTags)],
        sellerId:      user?._id,
        sellerName:    user?.name || user?.email,
        hasModelShot:  !!completedPhotos[4],
      })
      await refreshUser()
      setPhase('success')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'success') return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center pb-24 text-center px-6">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="font-bold text-2xl text-gray-800 mb-2">Item Listed!</h2>
      <p className="text-gray-500 mb-2">Your item is now live on Looped</p>
      {completedPhotos[4] && (
        <p className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full mb-4">
          On-model shot included — boosts your listing visibility!
        </p>
      )}
      <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
        <button onClick={() => { setPhase('photos'); setCurrentPhotoStep(1); setCompletedPhotos({}); setAllAutoTags([]) }}
          className="btn-outline">List Another Item</button>
        <button onClick={() => navigate('/profile')} className="btn-primary">View My Listings</button>
      </div>
    </div>
  )

  if (phase === 'photos') return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">List an Item</h1>
        <span className="text-xs text-gray-400">Photos {Math.min(currentPhotoStep, 4)}/4</span>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1.5">
          {PHOTO_STEPS.map(({ step, label }) => {
            const done    = !!completedPhotos[step]
            const current = step === currentPhotoStep
            return (
              <div key={step} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all duration-300
                  ${done ? 'bg-pink-500' : current ? 'bg-pink-300' : 'bg-pink-100'}`} />
                <p className={`text-[10px] mt-1 text-center font-medium truncate
                  ${done ? 'text-pink-500' : current ? 'text-gray-600' : 'text-gray-300'}`}>
                  {done ? '✓ ' : ''}{label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {Object.keys(completedPhotos).length > 0 && (
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Uploaded photos</p>
          <div className="flex gap-2">
            {PHOTO_STEPS.map(({ step }) =>
              completedPhotos[step] ? (
                <div key={step} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-pink-300">
                  <img src={completedPhotos[step].previewUrl} className="w-full h-full object-cover" alt="" />
                  <div className="absolute bottom-0 right-0 bg-pink-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-tl-lg">
                    {step}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      <div className="px-4 pt-2">
        <PhotoUploadStep
          key={currentPhotoStep}
          step={currentPhotoStep}
          onComplete={(data) => handlePhotoComplete(currentPhotoStep, data)}
          onSkip={handlePhotoSkip}
          existingFile={completedPhotos[currentPhotoStep]?.file || null}
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setPhase('photos')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 text-lg">Listing Details</h1>
      </div>

      <div className="px-4 pt-4 pb-3 bg-pink-50 border-b border-pink-100">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          {Object.keys(completedPhotos).length} photo{Object.keys(completedPhotos).length !== 1 ? 's' : ''} uploaded
          {completedPhotos[4] && <span className="text-green-600 ml-2">✓ On-model shot included</span>}
        </p>
        <div className="flex gap-2">
          {PHOTO_STEPS.map(({ step }) =>
            completedPhotos[step] ? (
              <img key={step} src={completedPhotos[step].previewUrl}
                className="w-14 h-14 rounded-xl object-cover border-2 border-pink-200" alt="" />
            ) : null
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Title *</label>
          <input className="input" placeholder="e.g. Vintage Levi's Denim Jacket"
            value={form.title} onChange={set('title')} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Your Price (₹) *</label>
            <input className="input" type="number" placeholder="999"
              value={form.price} onChange={set('price')} required min="1" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Original Price (₹)</label>
            <input className="input" type="number" placeholder="2499"
              value={form.originalPrice} onChange={set('originalPrice')} min="1" />
          </div>
        </div>

        {/* ── AI price suggestion — appears automatically ── */}
        <PriceSuggestion
          brand={form.brand}
          category={form.category}
          condition={form.condition}
          originalPrice={form.originalPrice}
          onAccept={(price) => setForm(f => ({ ...f, price: String(price) }))}
        />

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Condition *</label>
          <select className="input" value={form.condition} onChange={set('condition')}>
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Category *</label>
          <select className="input" value={form.category} onChange={set('category')}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Brand</label>
            <input className="input" placeholder="Zara, H&M…" value={form.brand} onChange={set('brand')} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Size</label>
            <input className="input" placeholder="S, M, 38…" value={form.size} onChange={set('size')} />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">
            Tags
            {allAutoTags.length > 0 && (
              <span className="ml-2 text-purple-500 font-normal text-xs">
                ✨ {allAutoTags.length} auto-detected from photos
              </span>
            )}
          </label>
          <input className="input" placeholder="japan, streetwear, vintage, winter"
            value={form.tags} onChange={set('tags')} />
          <p className="text-xs text-gray-400 mt-1">Comma separated. Tags help buyers find your item.</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
          <textarea className="input resize-none h-24"
            placeholder="Describe fabric, fit, any flaws…"
            value={form.description} onChange={set('description')} />
        </div>

        <button type="submit" className="btn-primary flex items-center justify-center gap-2" disabled={loading}>
          {loading ? <Spinner size="sm" /> : '🚀 Publish Listing'}
        </button>
      </form>
    </div>
  )
}
