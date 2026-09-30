import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [swipeDir, setSwipeDir] = useState(null)
  const [likedCount, setLikedCount] = useState(0)
  const cardRef = useRef(null)
  const cardStartTimeRef = useRef(Date.now())

  useEffect(() => {
    loadDeck()
  }, [user?._id])

  useEffect(() => {
    cardStartTimeRef.current = Date.now()
  }, [idx, deck])

  const loadDeck = async () => {
    setLoading(true)
    try {
      const data = await getProducts({ userId: user?._id, forSwipe: true })
      setDeck(data)
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
    const dwellTimeMs = Date.now() - cardStartTimeRef.current
    animate('right', async () => {
      if (token) {
        try {
          await api.post('/user/swipe', {
            productId: current._id,
            action: 'right',
            dwellTimeMs
          })
          setLikedCount(c => c + 1)
          refreshUser()
        } catch {}
      }
      setIdx(i => i + 1)
    })
  }

  const handleSkip = () => {
    if (!current) return
    const dwellTimeMs = Date.now() - cardStartTimeRef.current
    animate('left', async () => {
      if (token) {
        try {
          await api.post('/user/swipe', {
            productId: current._id,
            action: 'left',
            dwellTimeMs
          })
          refreshUser()
        } catch {}
      }
      setIdx(i => i + 1)
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pb-24" style={{ backgroundColor: 'var(--cream)' }}>
      <Spinner size="lg" />
    </div>
  )

  if (!current) return (
    <div className="min-h-screen flex flex-col items-center justify-center pb-24 px-6 text-center" style={{ backgroundColor: 'var(--cream)' }}>
      <p className="text-5xl mb-4">🎉</p>
      <h2 className="font-bold text-2xl mb-2" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>You've seen it all! ✦</h2>
      <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>You liked <strong>{likedCount}</strong> items today</p>
      <p className="text-sm mb-6 font-semibold" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>Your feed is now personalised ✦</p>
      <button onClick={loadDeck} className="btn-primary max-w-xs">Shuffle Again ✦</button>
      <button onClick={() => navigate('/')} className="btn-outline max-w-xs mt-3">Back to Home</button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <h1 className="text-3xl select-none" style={{ fontFamily: "'Parisienne', cursive", color: 'var(--pink-deep)' }}>
          Looped
        </h1>
        <span className="text-xs font-semibold" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>{idx + 1} / {deck.length}</span>
      </div>

      {/* Progress bar */}
      <div className="mx-6 h-1.5 rounded-full mb-4 overflow-hidden" style={{ backgroundColor: 'var(--pink-blush)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${((idx) / deck.length) * 100}%`,
            backgroundColor: 'var(--pink-hot)'
          }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div
          ref={cardRef}
          className={`swipe-card w-full max-w-sm rounded-3xl overflow-hidden ${
            swipeDir === 'left' ? 'swipe-left' : swipeDir === 'right' ? 'swipe-right' : ''
          }`}
          style={{
            backgroundColor: 'var(--ivory)',
            border: '1px solid var(--pink-cotton)',
            boxShadow: 'var(--shadow)'
          }}
        >
          {/* Image */}
          <div className="relative h-96" style={{ backgroundColor: 'var(--pink-blush)' }}>
            <img
              src={current.image}
              alt={current.title}
              className="w-full h-full object-cover"
              onError={e => { e.target.src = `https://picsum.photos/seed/${current._id}/400/500` }}
            />
            {/* Gradient overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-white font-bold text-xl leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>{current.title}</h3>
              <p className="font-bold text-2xl mt-0.5 drop-shadow-sm" style={{ color: 'var(--pink-blush)', fontFamily: "'Fredoka', sans-serif" }}>{formatPrice(current.price)}</p>
            </div>
          </div>

          {/* Info strip */}
          <div className="p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--ivory)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--pink-mauve)' }}>Condition: <span className="font-semibold">{current.condition}</span></p>
              <p className="text-xs" style={{ color: 'var(--pink-mauve)' }}>Seller: <span className="font-semibold">{current.sellerName}</span></p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
              {current.tags?.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--pink-blush)', color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}
                >
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
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 border"
          style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* View detail */}
        <button
          onClick={() => navigate(`/product/${current._id}`)}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border"
          style={{ backgroundColor: 'var(--pink-blush)', borderColor: 'var(--pink-cotton)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pink-deep)" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        {/* Like */}
        <button
          onClick={handleLike}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg text-white"
          style={{
            backgroundColor: 'var(--pink-hot)',
            boxShadow: '0 8px 20px -6px rgba(236,111,167,0.6)'
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      {!token && (
        <p className="text-center text-xs pb-2" style={{ color: 'var(--pink-mauve)' }}>
          <span className="font-semibold cursor-pointer underline" style={{ color: 'var(--pink-hot)' }} onClick={() => navigate('/login')}>Sign in</span> to save likes & get personalised recommendations
        </p>
      )}
    </div>
  )
}
