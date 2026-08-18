import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ProductCard from '../components/ProductCard'
import Spinner from '../components/Spinner'
import StarRating from '../components/StarRating'
import ReviewCard from '../components/ReviewCard'
import SaveToCollectionModal from '../components/SaveToCollectionModal'
import { getProduct } from '../services/productService'
import { getProductReviews, createReview, deleteReview } from '../services/reviewService'
import { requestRental } from '../services/rentalService'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { formatPrice, conditionColor, tagColor } from '../utils/helpers'
import api from '../services/api'

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, token, refreshUser } = useAuth()
  const { addToCart } = useCart()

  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [liked, setLiked]             = useState(false)
  const [addedCart, setAddedCart]     = useState(false)
  const [cartLoading, setCartLoading] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Rental state
  const [startDate, setStartDate]           = useState('')
  const [endDate, setEndDate]               = useState('')
  const [requestingRental, setRequestingRental] = useState(false)
  const [rentalError, setRentalError]       = useState(null)
  const [rentalSuccess, setRentalSuccess]   = useState(null)

  // Reviews state
  const [reviews, setReviews]               = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [newRating, setNewRating]           = useState(5)
  const [newComment, setNewComment]         = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError]       = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchData()
    fetchReviews()
  }, [id])

  useEffect(() => {
    if (user && data) {
      setLiked(user.likedItems?.some(i => (i._id || i) === id))
    }
  }, [user, data])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getProduct(id)
      setData(res)
    } catch {
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchReviews = async () => {
    setReviewsLoading(true)
    try {
      const res = await getProductReviews(id)
      setReviews(Array.isArray(res) ? res : res?.reviews || [])
    } catch (err) {
      console.error('Failed to fetch reviews', err)
    } finally {
      setReviewsLoading(false)
    }
  }

  const handleLike = async () => {
    if (!token) return navigate('/login')
    try {
      await api.post('/user/like', { productId: id })
      setLiked(l => !l)
      refreshUser()
    } catch {}
  }

  const handleAddToCart = async () => {
    if (!token) return navigate('/login')
    setCartLoading(true)
    const ok = await addToCart(id)
    setCartLoading(false)
    if (ok !== false) setAddedCart(true)
  }

  const handleChat = async () => {
    if (!token) return navigate('/login')
    if (!product) return
    try {
      await api.post('/chat/conversation', {
        productId:    product._id,
        productTitle: product.title,
        productImage: product.image,
        sellerId:     product.sellerId,
        sellerName:   product.sellerName,
      })
    } catch {}
    navigate('/chat')
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!token) return navigate('/login')
    if (newRating < 1) {
      setReviewError('Please select a star rating')
      return
    }

    setSubmittingReview(true)
    setReviewError(null)
    try {
      await createReview(id, newRating, newComment)
      setNewComment('')
      setNewRating(5)
      // Refresh reviews list and product details for updated rating count
      await fetchReviews()
      const updatedProduct = await getProduct(id)
      setData(updatedProduct)
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Could not post review. Please try again.')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleDeleteReview = async (reviewId) => {
    try {
      await deleteReview(reviewId)
      fetchReviews()
      const updatedProduct = await getProduct(id)
      setData(updatedProduct)
    } catch (err) {
      console.error('Failed to delete review', err)
    }
  }

  const handleRequestRental = async (e) => {
    e.preventDefault()
    if (!token) return navigate('/login')
    if (!startDate || !endDate) {
      setRentalError('Please select both start and end dates.')
      return
    }
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    if (days <= 0) {
      setRentalError('End date must be after start date.')
      return
    }

    setRequestingRental(true)
    setRentalError(null)
    setRentalSuccess(null)
    try {
      await requestRental(id, startDate, endDate)
      setRentalSuccess('Rental request submitted! Track progress in your Profile under My Rentals.')
    } catch (err) {
      setRentalError(err.response?.data?.message || 'Could not submit rental request. Please try again.')
    } finally {
      setRequestingRental(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
  if (!data) return null

  const { product, similar, completeTheLook } = data

  const userIdStr = user?._id?.toString() || user?.id?.toString()
  const sellerIdStr = product?.sellerId?.toString()
  const isSeller = Boolean(userIdStr && sellerIdStr && userIdStr === sellerIdStr)

  const isRentable = product.listingType === 'rent' || product.listingType === 'both' || Boolean(product.rentPricePerDay) || product.rentAvailable !== false
  const rentPerDay = product.rentPricePerDay || Math.max(50, Math.round(((product.price || 1000) * 0.05) / 10) * 10)
  const depositAmt = product.securityDeposit || Math.round(((product.price || 1000) * 0.3) / 50) * 50

  const rentalDays = (startDate && endDate)
    ? Math.max(0, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)))
    : 0
  const totalRentAmount = rentalDays * rentPerDay

  return (
    <div className="min-h-screen bg-pink-50 pb-32">
      {/* Back button header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-pink-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-pink-500 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="font-semibold text-gray-800 text-sm truncate flex-1">{product.title}</span>

        {/* Action icons: Save to Collection + Like */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSaveModal(true)}
            className="p-1.5 text-gray-500 hover:text-pink-500 transition-colors"
            title="Save to collection"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button onClick={handleLike} className="p-1.5" title={liked ? 'Unlike' : 'Like'}>
            <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2"
              fill={liked ? '#ec4899' : 'none'} stroke={liked ? '#ec4899' : '#9ca3af'}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main image */}
      <div className="bg-white">
        <img
          src={product.image}
          alt={product.title}
          className="w-full object-cover max-h-[420px]"
          onError={e => { e.target.src = `https://picsum.photos/seed/${id}/400/500` }}
        />
      </div>

      {/* Product info card */}
      <div className="bg-white mx-0 px-5 pt-5 pb-6 border-b border-pink-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h1 className="font-bold text-gray-900 text-xl leading-snug">{product.title}</h1>
            {/* Avg Rating summary near title/price */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <StarRating rating={product.avgRating || 0} size="sm" />
              <span className="text-xs font-bold text-gray-800">
                {product.avgRating ? Number(product.avgRating).toFixed(1) : 'No ratings'}
              </span>
              {product.reviewCount > 0 && (
                <span className="text-xs text-gray-400">
                  ({product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-pink-600 font-bold text-xl">{formatPrice(product.price)}</p>
            {product.originalPrice && (
              <p className="text-gray-400 text-xs line-through">{formatPrice(product.originalPrice)}</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3 mt-3">
          <span className={`tag-badge ${conditionColor[product.condition] || 'bg-gray-100 text-gray-600'}`}>
            {product.condition}
          </span>
          <span className="tag-badge bg-purple-100 text-purple-700">{product.category}</span>
          {product.size && <span className="tag-badge bg-blue-100 text-blue-700">Size: {product.size}</span>}
          {product.brand && <span className="tag-badge bg-amber-100 text-amber-700">{product.brand}</span>}
        </div>

        {/* Seller info */}
        <div className="flex items-center gap-3 py-3 border-t border-b border-pink-50 my-3">
          <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center">
            <span className="text-pink-600 font-bold text-sm">{product.sellerName?.[0] || 'S'}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Seller</p>
            <p className="text-sm font-semibold text-gray-800">{product.sellerName || 'Anonymous'}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            <span>👁 {product.views || 0}</span>
            <span>❤️ {product.likes || 0}</span>
          </div>
        </div>

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            {product.tags.map(tag => (
              <span key={tag} className={`tag-badge ${tagColor(tag)}`}>#{tag}</span>
            ))}
          </div>
        )}

        {product.description && (
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">{product.description}</p>
        )}
      </div>

      {/* Renting Section */}
      {isRentable && (
        <div className="bg-white mx-0 px-5 py-5 border-b border-pink-100 mt-3 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👗</span>
              <div>
                <h2 className="font-bold text-gray-900 text-lg leading-tight">Rent This Item</h2>
                <p className="text-xs text-gray-400">Wear it for your next event without buying</p>
              </div>
            </div>
            {product.rentPriceMatchScore > 0.85 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                ⚡ Fair Price AI
              </span>
            )}
          </div>

          <div className="bg-pink-50/60 rounded-2xl p-4 border border-pink-100 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-pink-100">
              <span className="text-gray-600 font-medium">Daily Rental Rate</span>
              <strong className="text-pink-600 font-bold text-base">₹{rentPerDay}/day</strong>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-pink-100">
              <span className="text-gray-600 font-medium">Security Deposit (Refundable)</span>
              <strong className="text-gray-800 font-semibold">{formatPrice(depositAmt)}</strong>
            </div>

            {rentalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl">
                {rentalError}
              </div>
            )}

            {rentalSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center justify-between">
                <span>✓ {rentalSuccess}</span>
                <button
                  onClick={() => navigate('/profile')}
                  className="font-bold text-emerald-800 underline ml-2"
                >
                  View Rentals
                </button>
              </div>
            )}

            {!token ? (
              <div className="text-center py-2">
                <p className="text-xs text-gray-600 mb-2 font-medium">Log in to request a rental</p>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary py-2 px-5 text-xs inline-block"
                >
                  Log In to Rent
                </button>
              </div>
            ) : isSeller ? (
              <div className="text-center py-2 text-xs text-gray-400 italic">
                This is your listing.
              </div>
            ) : (
              <form onSubmit={handleRequestRental} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setStartDate(e.target.value)}
                      className="input text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      onChange={e => setEndDate(e.target.value)}
                      className="input text-xs"
                      required
                    />
                  </div>
                </div>

                {rentalDays > 0 && (
                  <div className="bg-white rounded-xl p-3 border border-pink-100 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Rental Duration:</span>
                      <strong className="text-gray-800">{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Rent Total:</span>
                      <span>₹{rentPerDay} × {rentalDays} = <strong>{formatPrice(totalRentAmount)}</strong></span>
                    </div>
                    <div className="flex justify-between text-pink-600 font-bold pt-1 border-t border-gray-100 text-sm">
                      <span>Total Due (incl. deposit):</span>
                      <span>{formatPrice(totalRentAmount + depositAmt)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={requestingRental || !startDate || !endDate}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs py-3 rounded-xl hover:from-pink-600 hover:to-rose-600 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {requestingRental ? <Spinner size="sm" /> : 'Request Rental'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="bg-white mx-0 px-5 py-5 border-b border-pink-100 mt-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-lg">Reviews & Ratings</h2>
          {product.avgRating > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating rating={product.avgRating} size="sm" />
              <span className="text-xs font-bold text-gray-800">{Number(product.avgRating).toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Review Form / Prompt / Seller check */}
        {isSeller ? (
          <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100 mb-6">
            <p className="text-xs text-gray-400 italic">As the seller of this item, you cannot review it.</p>
          </div>
        ) : !token ? (
          <div className="bg-pink-50/80 rounded-2xl p-4 text-center border border-pink-100 mb-6">
            <p className="text-xs text-gray-600 mb-2.5 font-medium">Log in to leave a review</p>
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 bg-pink-500 text-white rounded-xl text-xs font-semibold hover:bg-pink-600 transition-all inline-block shadow-xs"
            >
              Log In
            </button>
          </div>
        ) : (
          <form onSubmit={handleReviewSubmit} className="bg-pink-50/60 border border-pink-100 rounded-2xl p-4 mb-6 space-y-3">
            <p className="text-xs font-bold text-gray-800">Write a Review</p>
            {reviewError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                {reviewError}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Your Rating:</span>
              <StarRating rating={newRating} interactive={true} onChange={setNewRating} size="md" />
            </div>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Share details about this item or seller experience..."
              rows={3}
              className="input text-xs"
            />
            <button
              type="submit"
              disabled={submittingReview || newRating === 0}
              className="btn-primary py-2.5 text-xs flex items-center justify-center gap-2"
            >
              {submittingReview ? <Spinner size="sm" /> : 'Submit Review'}
            </button>
          </form>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="py-6 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-2xl mb-1">💬</p>
            <p className="text-xs font-medium text-gray-600">No reviews yet — be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(review => (
              <ReviewCard
                key={review._id}
                review={review}
                canDelete={user && (review.user?._id === user._id || review.userId === user._id)}
                onDelete={handleDeleteReview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-pink-100 px-4 py-3 flex gap-3 z-30">
        <button
          onClick={handleChat}
          className="btn-outline flex-1 flex items-center justify-center gap-2 py-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </button>
        <button
          onClick={handleAddToCart}
          disabled={cartLoading}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all
            ${addedCart
              ? 'bg-green-100 text-green-700 border-2 border-green-300'
              : 'bg-pink-500 text-white hover:bg-pink-600 active:scale-95'}`}
        >
          {cartLoading ? <Spinner size="sm" /> : addedCart ? '✓ Added to Cart' : 'Add to Cart'}
        </button>
      </div>

      {/* Similar items */}
      {similar?.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="font-bold text-gray-800 mb-3">Similar Items</h3>
          <div className="scroll-row">
            {similar.map(p => <ProductCard key={p._id} product={p} size="sm" />)}
          </div>
        </div>
      )}

      {/* Complete the look */}
      {completeTheLook?.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="font-bold text-gray-800 mb-3">Complete the Look</h3>
          <div className="scroll-row">
            {completeTheLook.map(p => <ProductCard key={p._id} product={p} size="sm" />)}
          </div>
        </div>
      )}

      {/* Save to Collection Modal */}
      <SaveToCollectionModal
        productId={product._id}
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
      />
    </div>
  )
}
