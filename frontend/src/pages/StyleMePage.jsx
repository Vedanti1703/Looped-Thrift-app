import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { styleMeQuery } from '../services/styleMeService'
import { formatPrice, conditionColor, truncate } from '../utils/helpers'

// ── Quick prompt suggestions ──────────────────────────────────────────────
const SUGGESTIONS = [
  { emoji: '🎓', text: 'College farewell, classy black outfit under ₹2000' },
  { emoji: '🌸', text: 'Y2K outfit for a college party, pink or white' },
  { emoji: '🛹', text: 'Streetwear for college under ₹1800, oversized' },
  { emoji: '☀️', text: 'Casual summer outfit under ₹1200' },
  { emoji: '🎉', text: 'Festive Indian outfit for Diwali under ₹3000' },
  { emoji: '💼', text: 'Smart casual work outfit under ₹2500' },
]

// ── Compact product tile reused inside outfit card ────────────────────────
function OutfitProductTile({ product, onViewProduct }) {
  return (
    <div
      onClick={() => onViewProduct(product._id)}
      className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-xl p-2.5 cursor-pointer
                 hover:bg-white/90 hover:shadow-sm transition-all duration-200 group border border-white/40"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-pink-50">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { e.target.src = `https://placehold.co/200x200/f9a8d4/4a4a4a?text=${encodeURIComponent(product.category || 'Product')}` }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 leading-snug">{truncate(product.title, 30)}</p>
        <p className="text-xs text-gray-500 mt-0.5">{product.category}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-pink-600 font-bold text-xs">{formatPrice(product.price)}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${conditionColor[product.condition] || 'bg-gray-100 text-gray-600'}`}>
            {product.condition}
          </span>
        </div>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-pink-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </div>
  )
}

// ── Style match % ring ─────────────────────────────────────────────────────
function StyleMatchRing({ pct }) {
  const radius = 18
  const circ   = 2 * Math.PI * radius
  const dash   = (pct / 100) * circ
  const color  = pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ec4899'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="4"/>
        <circle
          cx="24" cy="24" r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="24" y="28" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Style Match</span>
    </div>
  )
}

// ── Outfit card ─────────────────────────────────────────────────────────────
function OutfitCard({ outfit, index, onAddOutfitToCart, addingId }) {
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)

  const handleAdd = async () => {
    await onAddOutfitToCart(outfit.outfitId, outfit.items)
    setAdded(true)
    setTimeout(() => setAdded(false), 3000)
  }

  const gradients = [
    'from-violet-50 via-pink-50 to-rose-50',
    'from-sky-50 via-indigo-50 to-purple-50',
    'from-emerald-50 via-teal-50 to-cyan-50',
  ]
  const borderColors = ['border-violet-100', 'border-sky-100', 'border-emerald-100']

  return (
    <div className={`rounded-2xl border ${borderColors[index % 3]} bg-gradient-to-br ${gradients[index % 3]} overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Look {index + 1}</span>
            {outfit.matchType && outfit.matchType !== 'exact' && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide
                ${outfit.matchType === 'partial'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-600'
                }`}>
                {outfit.matchType === 'partial' ? 'Similar Match' : 'Closest Alternative'}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-extrabold text-gray-900">{formatPrice(outfit.totalPrice)}</span>
            <span className="text-xs text-gray-400">{outfit.items.length} pieces</span>
          </div>
        </div>
        <StyleMatchRing pct={outfit.styleMatch} />
      </div>
      {/* Fallback note */}
      {outfit.fallbackNote && (
        <div className="mx-4 mb-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
          <span className="text-sm flex-shrink-0">⚠️</span>
          <p className="text-[11px] text-amber-700 leading-snug">{outfit.fallbackNote}</p>
        </div>
      )}

      {/* Products */}
      <div className="px-4 space-y-2 pb-3">
        {outfit.items.map(product => (
          <OutfitProductTile
            key={product._id}
            product={product}
            onViewProduct={(id) => navigate(`/product/${id}`)}
          />
        ))}
      </div>

      {/* AI Explanation */}
      {outfit.explanation && (
        <div className="mx-4 mb-3 bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60">
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0">✨</span>
            <p className="text-xs text-gray-700 leading-relaxed italic">{outfit.explanation}</p>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="px-4 pb-4">
        <button
          id={`add-outfit-${index}`}
          onClick={handleAdd}
          disabled={addingId === outfit.outfitId || added}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2
            ${added
              ? 'bg-emerald-500 text-white'
              : addingId === outfit.outfitId
                ? 'bg-pink-200 text-pink-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:from-pink-600 hover:to-violet-600 hover:shadow-md active:scale-95'
            }`}
        >
          {added ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Added to Cart!
            </>
          ) : addingId === outfit.outfitId ? (
            <>
              <div className="w-4 h-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"/>
              Adding…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              Add Outfit to Cart
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Preference chips (v2 — hard_constraints + soft_preferences) ────────────
function PreferenceChips({ prefs }) {
  if (!prefs) return null
  const chips = []
  // v2 structured shape
  const hc = prefs.hard_constraints || {}
  const sp = prefs.soft_preferences || {}
  const sk = prefs.style_keywords || []

  for (const color of (hc.colors || []).slice(0, 3))
    chips.push({ label: color, icon: '🎨', strong: true })
  for (const cat of (hc.category_keywords || []).slice(0, 3))
    chips.push({ label: cat, icon: '👕', strong: true })
  if (hc.max_price)
    chips.push({ label: `Under ${formatPrice(hc.max_price)}`, icon: '💰', strong: true })

  if (sp.occasion)  chips.push({ label: sp.occasion, icon: '🎯' })
  if (sp.fit)       chips.push({ label: sp.fit, icon: '📐' })
  if (sp.gender)    chips.push({ label: sp.gender, icon: '👤' })
  if (sp.season)    chips.push({ label: sp.season, icon: '🌦️' })
  for (const kw of sk.slice(0, 3))
    chips.push({ label: kw, icon: '✨' })

  // Fallback: old flat shape (backward compat)
  if (chips.length === 0) {
    if (prefs.occasion) chips.push({ label: prefs.occasion, icon: '🎯' })
    if (prefs.style)    chips.push({ label: prefs.style, icon: '✨' })
    if (prefs.budget)   chips.push({ label: `Under ${formatPrice(prefs.budget)}`, icon: '💰', strong: true })
    for (const color of (prefs.colors || []).slice(0, 3))
      chips.push({ label: color, icon: '🎨', strong: true })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {chips.map((c, i) => (
        <span key={i} className={`text-[11px] border rounded-full px-2.5 py-1 font-medium flex items-center gap-1
          ${c.strong
            ? 'bg-violet-50 text-violet-700 border-violet-200'
            : 'bg-pink-50 text-pink-700 border-pink-100'
          }`}>
          <span>{c.icon}</span> {c.label}
        </span>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function StyleMePage() {
  const { addToCart } = useCart()
  const navigate = useNavigate()

  const [query, setQuery]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState('')
  const [addingId, setAddingId]     = useState(null)
  const textareaRef                 = useRef(null)

  const handleSubmit = async (q = query) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await styleMeQuery(q.trim())
      setResult(data)
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Something went wrong'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestion = (text) => {
    setQuery(text)
    handleSubmit(text)
  }

  const handleAddOutfitToCart = async (outfitId, items) => {
    setAddingId(outfitId)
    try {
      for (const item of items) {
        await addToCart(item._id)
      }
    } finally {
      setAddingId(null)
    }
  }

  const handleTryAnother = () => {
    if (result?.query) handleSubmit(result.query)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-pink-50 to-violet-50 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-pink-100 px-4 py-3 flex items-center gap-3">
        <button
          id="style-me-back-btn"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center hover:bg-pink-100 transition-colors"
        >
          <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div>
          <h1 className="font-extrabold text-gray-900 text-base leading-tight">✨ AI Style Me</h1>
          <p className="text-[11px] text-gray-400 leading-none">Your personal Looped AI stylist</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Hero prompt box */}
        <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500 via-violet-500 to-fuchsia-500 px-4 py-3">
            <p className="text-white font-bold text-sm">Describe your outfit dream 👗</p>
            <p className="text-white/70 text-xs mt-0.5">Be specific: occasion, colors, budget, vibe</p>
          </div>

          <div className="p-3">
            <textarea
              ref={textareaRef}
              id="style-me-query-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              placeholder="e.g. I have a college farewell, I want a classy black outfit under ₹2000..."
              className="w-full text-sm text-gray-800 placeholder-gray-400 resize-none border-0 outline-none bg-transparent leading-relaxed"
              rows={3}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-gray-400">Press Enter or tap Style Me</span>
              <button
                id="style-me-submit-btn"
                onClick={() => handleSubmit()}
                disabled={loading || !query.trim()}
                className="flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white text-xs font-bold
                           px-4 py-2 rounded-xl hover:from-pink-600 hover:to-violet-600 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-200 active:scale-95"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <span>✨</span>
                )}
                Style Me
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions (only when no result loaded) */}
        {!result && !loading && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">✦ Try these looks</p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  id={`suggestion-${i}`}
                  onClick={() => handleSuggestion(s.text)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm text-gray-700
                             hover:border-pink-200 hover:bg-pink-50 transition-all duration-150 flex items-center gap-2.5 group"
                >
                  <span className="text-lg flex-shrink-0">{s.emoji}</span>
                  <span className="leading-snug group-hover:text-pink-700">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-pink-100"/>
              <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 border-r-violet-500 animate-spin"/>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-700 text-sm">Curating your outfits…</p>
              <p className="text-gray-400 text-xs mt-1">Searching real Looped inventory</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center max-w-xs">
              {['Extracting preferences', 'Searching inventory', 'Assembling outfits', 'Writing explanations'].map((step, i) => (
                <span key={i} className="text-[10px] bg-pink-50 text-pink-500 rounded-full px-2.5 py-1 font-medium animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                  {step}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 flex items-start gap-2">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div>
              <p className="font-bold">Could not generate outfits</p>
              <p className="text-xs mt-0.5 text-rose-600">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Query recap */}
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5 font-medium">Your request</p>
              <p className="text-sm font-bold text-gray-800">"{result.query}"</p>
            </div>

            {/* Extracted preferences */}
            <PreferenceChips prefs={result.preferences} />

            {/* No results message */}
            {result.outfits.length === 0 && (
              <div className="text-center py-10">
                <div className="text-5xl mb-3">🪄</div>
                <p className="font-bold text-gray-700">No complete outfits found</p>
                <p className="text-sm text-gray-500 mt-1">{result.message || 'Try broadening your budget or style.'}</p>
                <button
                  onClick={handleTryAnother}
                  className="mt-4 bg-pink-500 text-white text-sm font-bold px-5 py-2 rounded-full hover:bg-pink-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Outfit cards */}
            {result.outfits.map((outfit, i) => (
              <OutfitCard
                key={outfit.outfitId}
                outfit={outfit}
                index={i}
                onAddOutfitToCart={handleAddOutfitToCart}
                addingId={addingId}
              />
            ))}

            {/* Footer actions */}
            {result.outfits.length > 0 && (
              <div className="flex gap-3 pt-2">
                <button
                  id="try-another-look-btn"
                  onClick={handleTryAnother}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold border-2 border-pink-400 text-pink-600
                             hover:bg-pink-50 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
                  </svg>
                  Try Another Look
                </button>
                <button
                  id="new-query-btn"
                  onClick={() => { setResult(null); setQuery(''); textareaRef.current?.focus() }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold border-2 border-gray-200 text-gray-600
                             hover:bg-gray-50 transition-all duration-200"
                >
                  New Query
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
