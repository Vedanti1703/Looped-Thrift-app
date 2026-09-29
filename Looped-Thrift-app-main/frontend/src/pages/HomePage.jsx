import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import { GridSkeleton } from '../components/Skeleton'
import { getProducts } from '../services/productService'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { label: 'Recommended For You', tags: null,      key: 'recommended' },
  { label: 'Japan Vibe',           tags: 'japan',   key: 'japan'       },
  { label: 'Jaipur Wedding',       tags: 'jaipur',  key: 'jaipur'      },
  { label: 'London Winter',        tags: 'winter',  key: 'london'      },
]

export default function HomePage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [sections, setSections] = useState({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        SECTIONS.map(s =>
          getProducts({
            tags: s.tags || undefined,
            userId: user?._id || undefined,
          }).catch(() => [])
        )
      )
      const map = {}
      SECTIONS.forEach((s, i) => { map[s.key] = results[i].slice(0, 6) })
      setSections(map)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--cream)' }}>
      <Header />

      {/* Hero banner with ✦ gold star accents */}
      <div
        className="mx-4 mt-4 rounded-3xl overflow-hidden relative h-44 shadow-md"
        style={{
          background: 'linear-gradient(160deg, var(--pink-rose) 0%, var(--pink-hot) 55%, var(--pink-deep) 100%)',
          borderRadius: '24px'
        }}
      >
        <span className="absolute top-4 right-8 text-2xl select-none" style={{ color: 'var(--gold)', opacity: 0.85 }}>✦</span>
        <span className="absolute bottom-5 right-24 text-lg select-none" style={{ color: 'var(--gold)', opacity: 0.65 }}>✦</span>

        <div className="absolute inset-0 flex flex-col justify-center px-6">
          <p className="text-white/90 text-xs font-semibold tracking-wider uppercase mb-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            ✦ NEW IN THRIFT ✦
          </p>
          <h2 className="text-white text-3xl font-bold leading-tight drop-shadow-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
            Fashion that <br />
            <em className="text-3xl font-normal not-italic" style={{ fontFamily: "'Parisienne', cursive" }}>gives back</em>
          </h2>
          <button
            onClick={() => navigate('/discover')}
            className="mt-3 text-xs font-semibold px-5 py-2 rounded-full w-fit shadow-md transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--ivory)',
              color: 'var(--pink-deep)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            Explore Now ✦
          </button>
        </div>
      </div>

      {/* ✨ AI Style Me banner */}
      <div className="mx-4 mt-3">
        <button
          id="home-style-me-banner"
          onClick={() => navigate('/style-me')}
          className="w-full rounded-2xl overflow-hidden p-px shadow-sm text-left transition-transform active:scale-98"
          style={{
            background: 'linear-gradient(135deg, var(--pink-hot), var(--gold), var(--pink-deep))',
            borderRadius: '20px'
          }}
        >
          <div
            className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--ivory)',
              borderRadius: '19px'
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-xs"
                style={{
                  background: 'linear-gradient(135deg, var(--pink-blush), var(--pink-cotton))',
                  color: 'var(--pink-deep)'
                }}
              >
                ✦
              </div>
              <div className="text-left">
                <p className="text-sm font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
                  AI Style Me
                </p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: '#6b5560' }}>
                  Describe your vibe, get 2–3 real outfits
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-1 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 shadow-xs"
              style={{
                backgroundColor: 'var(--pink-hot)',
                fontFamily: "'Fredoka', sans-serif"
              }}
            >
              Try it ✦
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* Sections */}
      <div className="mt-6 space-y-6 px-4">
        {loading ? (
          <GridSkeleton count={4} />
        ) : (
          SECTIONS.map(s => (
            <section key={s.key}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg flex items-center gap-1.5" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-deep)' }}>
                  <span style={{ color: 'var(--gold)' }}>✦</span> {s.label}
                </h3>
                <button
                  onClick={() => navigate(`/discover${s.tags ? `?tags=${s.tags}` : ''}`)}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}
                >
                  See all ✦
                </button>
              </div>

              {sections[s.key]?.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: '#8F3F63', opacity: 0.6 }}>No items yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(sections[s.key] || []).slice(0, 4).map(p => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
