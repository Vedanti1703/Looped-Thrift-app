import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Spinner from '../components/Spinner'
import StarRating from '../components/StarRating'
import ReviewCard from '../components/ReviewCard'
import SaveToCollectionModal from '../components/SaveToCollectionModal'
import BargainModal from '../components/BargainModal'
import FitPredictor from '../components/FitPredictor'
import SizeMeasurements from '../components/SizeMeasurements'
import CarbonSavingsBadge from '../components/CarbonSavingsBadge'
import { getProduct } from '../services/productService'
import { getProductReviews, createReview, deleteReview } from '../services/reviewService'
import { requestRental } from '../services/rentalService'
import { getMyOffers } from '../services/bargainService'
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
  const [showBargainModal, setShowBargainModal] = useState(false)
  const [showSizeModal, setShowSizeModal] = useState(false)
  const [activeOffer, setActiveOffer] = useState(null)

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
    if (token) fetchUserOffer()
  }, [id, token])

  const fetchUserOffer = async () => {
    try {
      const offers = await getMyOffers(id)
      const myOffer = offers.find(o => o.productId?._id === id || o.productId === id)
      if (myOffer) setActiveOffer(myOffer)
    } catch (err) {
      console.warn('Could not load user offer', err)
    }
  }


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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
      <Spinner size="lg" />
    </div>
  )
  if (!data) return null

  const { product, similar, completeTheLook } = data

  const userIdStr = user?._id?.toString() || user?.id?.toString()
  const sellerIdStr = product?.sellerId?.toString()
  const isSeller = Boolean(userIdStr && sellerIdStr && userIdStr === sellerIdStr)

  const isRentable = (product.listingType === 'rent' || product.listingType === 'both') && Boolean(product.rentPricePerDay && product.rentPricePerDay > 0)
  const rentPerDay = product.rentPricePerDay || 0
  const depositAmt = product.securityDeposit || 0

  const rentalDays = (startDate && endDate)
    ? Math.max(0, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)))
    : 0
  const totalRentAmount = rentalDays * rentPerDay

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Back button header */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3 flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.92)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-pink-100 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="font-semibold text-sm truncate flex-1" style={{ color: 'var(--pink-mauve)' }}>{product.title}</span>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSaveModal(true)}
            className="p-1.5 text-gray-500 hover:text-pink-500 transition-colors"
            title="Save to collection"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button onClick={handleLike} className="p-1.5" title={liked ? 'Unlike' : 'Like'}>
            <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2"
              fill={liked ? '#EC6FA7' : 'none'} stroke={liked ? '#EC6FA7' : 'var(--pink-rose)'}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main image */}
      <div style={{ backgroundColor: 'var(--ivory)' }}>
        <img
          src={product.image}
          alt={product.title}
          className="w-full object-cover max-h-[420px]"
          onError={e => { e.target.src = `https://picsum.photos/seed/${id}/400/500` }}
        />
      </div>

      {/* Product info card */}
      <div
        className="mx-0 px-5 pt-5 pb-6 border-b"
        style={{
          backgroundColor: 'var(--ivory)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h1 className="font-bold text-2xl leading-snug" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>{product.title}</h1>
            {/* Avg Rating summary */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <StarRating rating={product.avgRating || 0} size="sm" />
              <span className="text-xs font-bold" style={{ color: 'var(--pink-mauve)' }}>
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
            <p className="font-bold text-2xl" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>
              {formatPrice(product.price)}
            </p>
            {product.originalPrice && (
              <p className="text-gray-400 text-xs line-through" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                {formatPrice(product.originalPrice)}
              </p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3 mt-3">
          <span className={`tag-badge ${conditionColor[product.condition] || 'bg-gray-100 text-gray-600'}`}>
            {product.condition}
          </span>
          <span className="tag-badge bg-[var(--pink-blush)] text-[var(--pink-mauve)]">{product.category}</span>
          {product.size && <span className="tag-badge bg-[var(--blue-sky)] text-[#2d5a7b]">Size: {product.size}</span>}
          {product.brand && <span className="tag-badge bg-[var(--paper)] text-[#8a6a3d]">{product.brand}</span>}
          <CarbonSavingsBadge category={product.category} condition={product.condition} />
        </div>

        {/* Active offer badge if buyer has one */}
        {activeOffer && (
          <div
            onClick={() => setShowBargainModal(true)}
            className="p-2.5 rounded-2xl border text-xs flex items-center justify-between cursor-pointer mb-3 shadow-2xs"
            style={{
              backgroundColor:
                activeOffer.status === 'accepted' ? '#DCEEDC' :
                activeOffer.status === 'countered' ? '#B7D2E6' :
                activeOffer.status === 'declined' ? '#FBE9EF' : 'var(--pink-blush)',
              borderColor: 'var(--pink-cotton)'
            }}
          >
            <div className="flex items-center gap-1.5 font-bold" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              <span>🏷️</span>
              <span>Offer Status: <span className="uppercase">{activeOffer.status}</span> ({formatPrice(activeOffer.offeredPrice)})</span>
            </div>
            <span className="text-[11px] underline" style={{ color: 'var(--pink-deep)' }}>View Offer ✦</span>
          </div>
        )}

        {/* Fit Predictor Engine */}
        <FitPredictor
          productId={product._id || id}
          onOpenMeasurements={() => setShowSizeModal(true)}
        />


        {/* Seller info */}
        <div className="flex items-center gap-3 py-3 border-t border-b border-pink-100 my-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center border" style={{ backgroundColor: 'var(--pink-blush)', borderColor: 'var(--pink-cotton)' }}>
            <span className="font-bold text-sm" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>{product.sellerName?.[0] || 'S'}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Seller</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--pink-mauve)' }}>{product.sellerName || 'Anonymous'}</p>
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
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--ink)' }}>{product.description}</p>
        )}
      </div>

      {/* Renting Section */}
      {isRentable && (
        <div className="mx-0 px-5 py-5 border-b mt-3 space-y-4" style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👗</span>
              <div>
                <h2 className="font-bold text-lg leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-deep)' }}>Rent This Item ✦</h2>
                <p className="text-xs text-gray-500">Wear it for your next event without buying</p>
              </div>
            </div>
            {product.rentPriceMatchScore > 0.85 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                ⚡ Fair Price AI
              </span>
            )}
          </div>

          <div className="rounded-2xl p-4 border space-y-3" style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-pink-100">
              <span className="text-gray-600 font-medium">Daily Rental Rate</span>
              <strong className="font-bold text-base" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>₹{rentPerDay}/day</strong>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-pink-100">
              <span className="text-gray-600 font-medium">Security Deposit (Refundable)</span>
              <strong className="font-semibold" style={{ color: 'var(--ink)', fontFamily: "'Fredoka', sans-serif" }}>{formatPrice(depositAmt)}</strong>
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
                    <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>Start Date</label>
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
                    <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>End Date</label>
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
                  <div className="rounded-xl p-3 border space-y-1 text-xs" style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}>
                    <div className="flex justify-between text-gray-600">
                      <span>Rental Duration:</span>
                      <strong style={{ color: 'var(--ink)' }}>{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Rent Total:</span>
                      <span>₹{rentPerDay} × {rentalDays} = <strong style={{ color: 'var(--pink-deep)' }}>{formatPrice(totalRentAmount)}</strong></span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-pink-100 text-sm" style={{ color: 'var(--pink-hot)' }}>
                      <span>Total Due (incl. deposit):</span>
                      <span>{formatPrice(totalRentAmount + depositAmt)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={requestingRental || !startDate || !endDate}
                  className="btn-primary w-full py-3 text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  {requestingRental ? <Spinner size="sm" /> : 'Request Rental ✦'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="mx-0 px-5 py-5 border-b mt-3" style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>Reviews & Ratings ✦</h2>
          {product.avgRating > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating rating={product.avgRating} size="sm" />
              <span className="text-xs font-bold" style={{ color: 'var(--pink-mauve)' }}>{Number(product.avgRating).toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Review Form */}
        {isSeller ? (
          <div className="rounded-2xl p-3 text-center border mb-6" style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}>
            <p className="text-xs text-gray-400 italic">As the seller of this item, you cannot review it.</p>
          </div>
        ) : !token ? (
          <div className="rounded-2xl p-4 text-center border mb-6" style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}>
            <p className="text-xs text-gray-600 mb-2.5 font-medium">Log in to leave a review</p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary px-5 py-2 text-xs inline-block"
            >
              Log In
            </button>
          </div>
        ) : (
          <form onSubmit={handleReviewSubmit} className="border rounded-2xl p-4 mb-6 space-y-3" style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>Write a Review ✦</p>
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
              {submittingReview ? <Spinner size="sm" /> : 'Submit Review ✦'}
            </button>
          </form>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="py-6 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 rounded-2xl border border-dashed border-pink-200" style={{ backgroundColor: 'var(--cream)' }}>
            <p className="text-2xl mb-1">💬</p>
            <p className="text-xs font-medium" style={{ color: 'var(--pink-mauve)' }}>No reviews yet — be the first!</p>
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
      <div
        className="fixed bottom-0 left-0 right-0 border-t px-3 py-3 flex gap-2 z-30 max-w-lg mx-auto"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.96)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <button
          onClick={handleChat}
          className="btn-outline px-3 py-3 rounded-full flex items-center justify-center gap-1 text-xs"
          title="Chat with seller"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </button>

        {!isSeller && (
          <button
            onClick={() => {
              if (!token) return navigate('/login', { state: { from: `/product/${id}` } })
              setShowBargainModal(true)
            }}
            className="btn-outline flex-1 py-3 text-xs flex items-center justify-center gap-1.5"
            style={{ borderColor: 'var(--pink-hot)', color: 'var(--pink-deep)' }}
          >
            <span>🏷️</span> Make an Offer
          </button>
        )}

        <button
          onClick={handleAddToCart}
          disabled={cartLoading}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-full font-semibold text-xs transition-all shadow-md ${
            addedCart ? 'bg-[#DCEEDC] text-[#48593E] border border-green-300' : 'btn-primary'
          }`}
          style={addedCart ? { fontFamily: "'Fredoka', sans-serif" } : {}}
        >
          {cartLoading ? <Spinner size="sm" /> : addedCart ? '✓ Added ✦' : 'Add to Cart ✦'}
        </button>
      </div>

      {/* Similar items */}
      {similar?.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="font-bold mb-3 flex items-center gap-1.5" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-deep)' }}>
            <span style={{ color: 'var(--gold)' }}>✦</span> Similar Items
          </h3>
          <div className="scroll-row">
            {similar.map(p => <ProductCard key={p._id} product={p} size="sm" />)}
          </div>
        </div>
      )}

      {/* Complete the look */}
      {completeTheLook?.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="font-bold mb-3 flex items-center gap-1.5" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-deep)' }}>
            <span style={{ color: 'var(--gold)' }}>✦</span> Complete the Look
          </h3>
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

      {/* Bargain Negotiation Modal */}
      <BargainModal
        isOpen={showBargainModal}
        onClose={() => setShowBargainModal(false)}
        product={product}
        existingOffer={activeOffer}
        onOfferUpdated={(updated) => setActiveOffer(updated)}
      />

      {/* Size Measurements Modal */}
      {showSizeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md relative">
            <button
              onClick={() => setShowSizeModal(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 bg-pink-100"
            >
              ✕
            </button>
            <SizeMeasurements onSaved={() => setShowSizeModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

