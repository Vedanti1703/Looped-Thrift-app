import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import ProductCard from '../components/ProductCard'
import { GridSkeleton } from '../components/Skeleton'
import { getProducts } from '../services/productService'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { label: '✨ Recommended For You', tags: null,      key: 'recommended' },
  { label: '🗾 Japan Vibe',           tags: 'japan',   key: 'japan'       },
  { label: '💍 Jaipur Wedding',       tags: 'jaipur',  key: 'jaipur'      },
  { label: '🧥 London Winter',        tags: 'winter',  key: 'london'      },
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
    <div className="min-h-screen bg-pink-50 pb-24">
      <Header />

      {/* Hero banner */}
      <div className="mx-4 mt-4 rounded-3xl overflow-hidden relative h-40 bg-gradient-to-r from-pink-400 to-rose-400">
        <div className="absolute inset-0 flex flex-col justify-center px-6">
          <p className="text-white/80 text-xs font-medium mb-1">NEW IN THRIFT</p>
          <h2 className="font-display text-white text-2xl italic leading-tight">
            Fashion that<br />gives back
          </h2>
          <button
            onClick={() => navigate('/discover')}
            className="mt-3 bg-white text-pink-500 text-xs font-bold px-4 py-1.5 rounded-full w-fit
                       hover:bg-pink-50 transition-colors"
          >
            Explore Now →
          </button>
        </div>
        <div className="absolute right-0 bottom-0 opacity-20 text-9xl">👗</div>
      </div>

      {/* Sections */}
      <div className="mt-6 space-y-6 px-4">
        {loading ? (
          <GridSkeleton count={4} />
        ) : (
          SECTIONS.map(s => (
            <section key={s.key}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-base">{s.label}</h3>
                <button
                  onClick={() => navigate(`/discover${s.tags ? `?tags=${s.tags}` : ''}`)}
                  className="text-pink-500 text-xs font-semibold hover:underline"
                >
                  See all
                </button>
              </div>

              {sections[s.key]?.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">No items yet</p>
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
