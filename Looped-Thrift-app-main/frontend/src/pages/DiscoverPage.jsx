import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { GridSkeleton } from '../components/Skeleton'
import { getProducts, getNaturalSearchResults, getVisualSearchResults } from '../services/productService'
import { uploadImage } from '../services/uploadService'

const CATEGORIES = ['All','Women\'s Tops','Women\'s Bottoms','Women\'s Outerwear','Women\'s Traditional',
  'Men\'s Tops','Men\'s Outerwear','Men\'s Bottoms','Accessories','Footwear','Bags','Jewelry','Women\'s Sets']
const CONDITIONS  = ['All','New with tags','Like New','Good','Fair','Well Loved']
const POPULAR_TAGS = ['ethnic','winter','summer','vacation','formal','japan','streetwear','vintage','y2k','wedding']

export default function DiscoverPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()

  const imageUrl = searchParams.get('imageUrl') || ''
  const [search, setSearch]                 = useState(searchParams.get('search') || '')
  const [searchMode, setSearchMode]         = useState(imageUrl ? 'visual' : 'natural')
  const [visualDescription, setVisualDesc]  = useState('')
  const [selectedTags, setTags]             = useState(searchParams.get('tags') ? [searchParams.get('tags')] : [])
  const [category, setCategory]             = useState('All')
  const [condition, setCondition]           = useState('All')
  const [minPrice, setMinPrice]             = useState('')
  const [maxPrice, setMaxPrice]             = useState('')
  const [products, setProducts]             = useState([])
  const [loading, setLoading]               = useState(false)
  const [uploadingImg, setUploadingImg]     = useState(false)
  const fileInputRef                        = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts()
    }, searchMode === 'natural' ? 400 : 0)

    return () => clearTimeout(timer)
  }, [imageUrl, search, searchMode, selectedTags, category, condition, minPrice, maxPrice])

  const fetchProducts = async () => {
    setLoading(true)

    try {
      if (imageUrl) {
        setSearchMode('visual')
        const res = await getVisualSearchResults(imageUrl)
        setVisualDesc(res.description || '')
        let filtered = res.products || []
        if (category !== 'All') filtered = filtered.filter(p => p.category === category)
        if (condition !== 'All') filtered = filtered.filter(p => p.condition === condition)
        if (minPrice) filtered = filtered.filter(p => p.price >= Number(minPrice))
        if (maxPrice) filtered = filtered.filter(p => p.price <= Number(maxPrice))
        setProducts(filtered)
      } else if (searchMode === 'natural' && search.trim()) {
        const results = await getNaturalSearchResults(search.trim())
        let filtered = results
        if (category !== 'All') filtered = filtered.filter(p => p.category === category)
        if (condition !== 'All') filtered = filtered.filter(p => p.condition === condition)
        if (minPrice) filtered = filtered.filter(p => p.price >= Number(minPrice))
        if (maxPrice) filtered = filtered.filter(p => p.price <= Number(maxPrice))
        setProducts(filtered)
      } else {
        const params = {}
        if (search)                  params.search   = search
        if (selectedTags.length)     params.tags     = selectedTags.join(',')
        if (category !== 'All')      params.category = category
        if (condition !== 'All')     params.condition = condition
        if (minPrice)                params.minPrice = minPrice
        if (maxPrice)                params.maxPrice = maxPrice
        const data = await getProducts(params)
        setProducts(data)
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleCameraUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingImg(true)
      const url = await uploadImage(file)
      navigate(`/discover?imageUrl=${encodeURIComponent(url)}`)
    } catch (err) {
      console.error('Failed to upload image:', err)
    } finally {
      setUploadingImg(false)
    }
  }

  const toggleTag = (tag) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleCameraUpload}
        className="hidden"
      />

      {/* Fixed top area */}
      <div
        className="sticky top-0 z-40 px-4 pt-4 pb-3 shadow-2xs border-b"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.94)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        {/* Mode Selector */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => { setSearchMode('natural'); if (imageUrl) navigate('/discover'); }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              searchMode === 'natural' && !imageUrl ? 'shadow-xs text-white' : 'hover:bg-pink-100'
            }`}
            style={{
              backgroundColor: searchMode === 'natural' && !imageUrl ? 'var(--pink-hot)' : 'var(--pink-blush)',
              color: searchMode === 'natural' && !imageUrl ? '#fff' : 'var(--pink-mauve)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            <span>✦ AI Search</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              imageUrl ? 'shadow-xs text-white' : 'hover:bg-pink-100'
            }`}
            style={{
              backgroundColor: imageUrl ? 'var(--pink-deep)' : 'var(--pink-blush)',
              color: imageUrl ? '#fff' : 'var(--pink-deep)',
              border: '1px solid var(--pink-cotton)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            {uploadingImg ? (
              <div className="w-3.5 h-3.5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>📷 Visual Search</span>
            )}
          </button>

          <button
            onClick={() => { setSearchMode('keyword'); if (imageUrl) navigate('/discover'); }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              searchMode === 'keyword' && !imageUrl ? 'shadow-xs text-white' : 'hover:bg-pink-100'
            }`}
            style={{
              backgroundColor: searchMode === 'keyword' && !imageUrl ? 'var(--pink-hot)' : 'var(--pink-blush)',
              color: searchMode === 'keyword' && !imageUrl ? '#fff' : 'var(--pink-mauve)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            <span>🔍 Keyword</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-3 flex items-center">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-full pl-9 pr-9 py-2 text-sm focus:outline-none transition"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: 'var(--ink)'
            }}
            placeholder={searchMode === 'natural' ? "Try: 'cute clothes for a Japan trip'..." : "Search by title, tag…"}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-500 hover:text-pink-600 text-base"
            title="Upload photo to search"
          >
            📷
          </button>
        </div>

        {/* Visual Search Active Banner */}
        {imageUrl && (
          <div
            className="border rounded-2xl p-3 mb-2 flex items-center justify-between shadow-xs"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)'
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={imageUrl} className="w-10 h-10 rounded-xl object-cover border flex-shrink-0" style={{ borderColor: 'var(--pink-cotton)' }} alt="Target" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>📷 Visual Search Results</p>
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>{visualDescription ? `"${visualDescription}"` : 'Analyzing photo...'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/discover')}
              className="text-xs border font-bold px-3 py-1 rounded-full flex-shrink-0 ml-2"
              style={{
                backgroundColor: 'var(--pink-blush)',
                borderColor: 'var(--pink-cotton)',
                color: 'var(--pink-deep)',
                fontFamily: "'Fredoka', sans-serif"
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 pb-1">
          <select
            value={category} onChange={e => setCategory(e.target.value)}
            className="text-xs border rounded-full px-3 py-1.5 focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: 'var(--ink)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select
            value={condition} onChange={e => setCondition(e.target.value)}
            className="text-xs border rounded-full px-3 py-1.5 focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: 'var(--ink)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            type="number" placeholder="Min ₹" value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            className="text-xs border rounded-full px-3 py-1.5 w-20 focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: 'var(--ink)'
            }}
          />
          <input
            type="number" placeholder="Max ₹" value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="text-xs border rounded-full px-3 py-1.5 w-20 focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: 'var(--ink)'
            }}
          />
        </div>

        {/* Popular Tags Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {POPULAR_TAGS.map(t => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 transition-colors"
              style={{
                backgroundColor: selectedTags.includes(t) ? 'var(--pink-hot)' : 'var(--pink-blush)',
                color: selectedTags.includes(t) ? '#fff' : 'var(--pink-deep)',
                fontFamily: "'Fredoka', sans-serif"
              }}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="p-4">
        {loading ? (
          <GridSkeleton count={6} />
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-2">🔍</p>
            <p className="font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>No items found</p>
            <p className="text-xs mt-1" style={{ color: '#6b5560' }}>Try uploading a different photo or adjusting your filters</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map(p => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
