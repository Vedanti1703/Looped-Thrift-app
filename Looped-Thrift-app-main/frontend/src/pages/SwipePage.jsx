import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'
import { getProducts } from '../services/productService'
import { useAuth } from '../context/AuthContext'
import { formatPrice } from '../utils/helpers'
import api from '../services/api'

export default function SwipePage() {
  const { user, token, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [deck, setDeck]     = useState([])
  const [idx, setIdx]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [swipeDir, setSwipeDir] = useState(null)   // 'left' | 'right' | null
  const [likedCount, setLikedCount] = useState(0)
  const cardRef = useRef(null)

  useEffect(() => {
    loadDeck()
  }, [])

  const loadDeck = async () => {
    setLoading(true)
    try {
      const data = await getProducts({ userId: user?._id })
      // Shuffle for variety
      setDeck(data.sort(() => Math.random() - 0.5))
      setIdx(0)
    } finally {
      setLoading(false)
    }
  }

  const current = deck[idx]

  const animate = (dir, callback) => {
    setSwipeDir(dir)
    setTimeout(() => {
      setSwipeDir(null)
      callback()
    }, 300)
  }

  const handleLike = async () => {
    if (!current) return
    animate('right', async () => {
      if (token) {
        try {
          await api.post('/user/like', { productId: current._id })
          setLikedCount(c => c + 1)
          refreshUser()
        } catch {}
      }
      setIdx(i => i + 1)
    })
  }

  const handleSkip = () => {
    if (!current) return
    animate('left', () => setIdx(i => i + 1))
  }

  if (loading) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center pb-24">
      <Spinner size="lg" />
    </div>
  )

  if (!current) return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center pb-24 px-6 text-center">
      <p className="text-5xl mb-4">🎉</p>
      <h2 className="font-bold text-xl text-gray-800 mb-2">You've seen it all!</h2>
      <p className="text-gray-500 text-sm mb-2">You liked <strong>{likedCount}</strong> items today</p>
      <p className="text-pink-500 text-sm mb-6">Your feed is now personalised ✨</p>
      <button onClick={loadDeck} className="btn-primary max-w-xs">Shuffle Again</button>
      <button onClick={() => navigate('/')} className="btn-outline max-w-xs mt-3">Back to Home</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-50 flex flex-col pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <h1 className="font-display text-2xl text-pink-500 italic">Looped</h1>
        <span className="text-xs text-gray-400 font-medium">{idx + 1} / {deck.length}</span>
      </div>

      {/* Progress bar */}
      <div className="mx-6 h-1 bg-pink-100 rounded-full mb-4">
        <div
          className="h-full bg-pink-400 rounded-full transition-all duration-300"
          style={{ width: `${((idx) / deck.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div
          ref={cardRef}
          className={`swipe-card w-full max-w-sm bg-white rounded-3xl shadow-lg overflow-hidden
            ${swipeDir === 'left' ? 'swipe-left' : swipeDir === 'right' ? 'swipe-right' : ''}`}
        >
          {/* Image */}
          <div className="relative h-96 bg-pink-50">
            <img
              src={current.image}
              alt={current.title}
              className="w-full h-full object-cover"
              onError={e => { e.target.src = `https://picsum.photos/seed/${current._id}/400/500` }}
            />
            {/* Gradient overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-white font-bold text-lg leading-tight">{current.title}</h3>
              <p className="text-pink-300 font-bold text-xl">{formatPrice(current.price)}</p>
            </div>
          </div>

          {/* Info strip */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Condition: <span className="font-semibold text-gray-700">{current.condition}</span></p>
              <p className="text-xs text-gray-500">Seller: <span className="font-semibold text-gray-700">{current.sellerName}</span></p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
              {current.tags?.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8 py-6">
        {/* Skip */}
        <button
          onClick={handleSkip}
          className="w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center
                     shadow-md hover:border-gray-400 active:scale-90 transition-all"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* View detail */}
        <button
          onClick={() => navigate(`/product/${current._id}`)}
          className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center
                     hover:bg-pink-200 active:scale-90 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        {/* Like */}
        <button
          onClick={handleLike}
          className="w-16 h-16 rounded-full bg-pink-500 flex items-center justify-center
                     shadow-lg shadow-pink-200 hover:bg-pink-600 active:scale-90 transition-all"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      {!token && (
        <p className="text-center text-xs text-gray-400 pb-2">
          <span className="text-pink-500 cursor-pointer underline" onClick={() => navigate('/login')}>Sign in</span> to save likes & get personalised recommendations
        </p>
      )}
    </div>
  )
}
