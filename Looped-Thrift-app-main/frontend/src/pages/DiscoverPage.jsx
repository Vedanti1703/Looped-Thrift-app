import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ProductCard from '../components/ProductCard'
import { GridSkeleton } from '../components/Skeleton'
import Spinner from '../components/Spinner'
import { getProducts } from '../services/productService'

const CATEGORIES = ['All','Women\'s Tops','Women\'s Bottoms','Women\'s Outerwear','Women\'s Traditional',
  'Men\'s Tops','Men\'s Outerwear','Men\'s Bottoms','Accessories','Footwear','Bags','Jewelry','Women\'s Sets']
const CONDITIONS  = ['All','New with tags','Like New','Good','Fair','Well Loved']
const POPULAR_TAGS = ['japan','winter','jaipur','wedding','streetwear','vintage','kawaii','minimalist','y2k','harajuku']

export default function DiscoverPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch]     = useState(searchParams.get('search') || '')
  const [selectedTags, setTags] = useState(searchParams.get('tags') ? [searchParams.get('tags')] : [])
  const [category, setCategory] = useState('All')
  const [condition, setCondition] = useState('All')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => { fetchProducts() }, [search, selectedTags, category, condition, minPrice, maxPrice])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)                           params.search   = search
      if (selectedTags.length)              params.tags     = selectedTags.join(',')
      if (category !== 'All')               params.category = category
      if (condition !== 'All')              params.condition = condition
      if (minPrice)                         params.minPrice = minPrice
      if (maxPrice)                         params.maxPrice = maxPrice
      const data = await getProducts(params)
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }

  const toggleTag = (tag) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  return (
    <div className="min-h-screen bg-pink-50 pb-24">
      {/* Fixed top area */}
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 pt-4 pb-3">
        {/* Search bar */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-pink-50 border border-pink-200 rounded-full pl-9 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="Search by title, tag…"
          />
        </div>

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

        {/* Tag chips */}
        <div className="flex gap-2 overflow-x-auto pt-2 pb-1 scrollbar-none">
          {POPULAR_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition-colors
                ${selectedTags.includes(tag)
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white text-gray-600 border-pink-200 hover:border-pink-400'}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 pt-4">
        <p className="text-xs text-gray-500 mb-3">
          {loading ? 'Searching…' : `${products.length} item${products.length !== 1 ? 's' : ''} found`}
        </p>

        {loading ? (
          <GridSkeleton count={6} />
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500 font-medium">No items found</p>
            <p className="text-gray-400 text-sm mt-1">Try different filters or tags</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
