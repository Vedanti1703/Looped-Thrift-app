import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { GridSkeleton } from '../components/Skeleton'
import { getProducts, getNaturalSearchResults, getVisualSearchResults } from '../services/productService'
import { uploadImage } from '../services/uploadService'

const CATEGORIES = ['All','Women\'s Tops','Women\'s Bottoms','Women\'s Outerwear','Women\'s Traditional',
  'Men\'s Tops','Men\'s Outerwear','Men\'s Bottoms','Accessories','Footwear','Bags','Jewelry','Women\'s Sets']
const CONDITIONS  = ['All','New with tags','Like New','Good','Fair','Well Loved']
const POPULAR_TAGS = ['japan','winter','jaipur','wedding','streetwear','vintage','kawaii','minimalist','y2k','harajuku']

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

  // Fetch when imageUrl, search, searchMode, or filters change
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
    <div className="min-h-screen bg-pink-50 pb-24 font-sans">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleCameraUpload}
        className="hidden"
      />

      {/* Fixed top area */}
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 pt-4 pb-3 shadow-2xs">
        {/* Mode Selector */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => { setSearchMode('natural'); if (imageUrl) navigate('/discover'); }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1
              ${searchMode === 'natural' && !imageUrl
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs'
                : 'bg-pink-50 text-gray-600 hover:bg-pink-100'}`}
          >
            <span>✨ AI Search</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1
              ${imageUrl
                ? 'bg-rose-500 text-white shadow-xs'
                : 'bg-pink-50 text-rose-600 hover:bg-pink-100 border border-rose-200'}`}
          >
            {uploadingImg ? (
              <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>📷 Visual Search</span>
            )}
          </button>

          <button
            onClick={() => { setSearchMode('keyword'); if (imageUrl) navigate('/discover'); }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1
              ${searchMode === 'keyword' && !imageUrl
                ? 'bg-pink-500 text-white shadow-xs'
                : 'bg-pink-50 text-gray-600 hover:bg-pink-100'}`}
          >
            <span>🔍 Keyword</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-3 flex items-center">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-pink-50 border border-pink-200 rounded-full pl-9 pr-9 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder={searchMode === 'natural' ? "Try: 'cute clothes for a Japan trip'..." : "Search by title, tag…"}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-600 text-base"
            title="Upload photo to search"
          >
            📷
          </button>
        </div>

        {/* Visual Search Active Banner */}
        {imageUrl && (
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-3 mb-2 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={imageUrl} className="w-10 h-10 rounded-xl object-cover border border-rose-300 flex-shrink-0" alt="Target" />
              <div className="min-w-0">
                <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">📷 Visual Search Results</p>
                <p className="text-xs font-semibold text-gray-800 truncate">{visualDescription ? `"${visualDescription}"` : 'Analyzing photo...'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/discover')}
              className="text-xs bg-white text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold px-3 py-1 rounded-full flex-shrink-0 shadow-2xs ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Filter row */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <select
            value={category} onChange={e => setCategory(e.target.value)}
            className="text-xs border border-pink-200 rounded-full px-3 py-1.5 bg-white focus:outline-none flex-shrink-0"
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select
            value={condition} onChange={e => setCondition(e.target.value)}
            className="text-xs border border-pink-200 rounded-full px-3 py-1.5 bg-white focus:outline-none flex-shrink-0"
          >
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            type="number" placeholder="Min ₹" value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            className="text-xs border border-pink-200 rounded-full px-3 py-1.5 bg-white w-20 focus:outline-none flex-shrink-0"
          />
          <input
            type="number" placeholder="Max ₹" value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="text-xs border border-pink-200 rounded-full px-3 py-1.5 bg-white w-20 focus:outline-none flex-shrink-0"
          />
        </div>

        {/* Popular Tags Pills */}
        <div className="flex gap-1.5 overflow-x-auto pt-2 scrollbar-none">
          {POPULAR_TAGS.map(t => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 transition-colors
                ${selectedTags.includes(t)
                  ? 'bg-pink-500 text-white'
                  : 'bg-white text-gray-600 border border-pink-200 hover:bg-pink-50'}`}
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
            <p className="font-semibold text-gray-700">No items found</p>
            <p className="text-gray-400 text-xs mt-1">Try uploading a different photo or adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
