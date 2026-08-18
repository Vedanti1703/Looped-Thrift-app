import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ProductCard from '../components/ProductCard'
import Spinner from '../components/Spinner'
import StarRating from '../components/StarRating'
import RentalStatusBadge from '../components/RentalStatusBadge'
import ListForRentModal from '../components/ListForRentModal'
import ConditionPhotoUpload from '../components/ConditionPhotoUpload'
import { useAuth } from '../context/AuthContext'
import { formatPrice, formatRelativeTime, truncate } from '../utils/helpers'
import { getSellerDashboard } from '../services/sellerService'
import { getCollections, getCollection, createCollection, removeItemFromCollection, deleteCollection } from '../services/collectionService'
import {
  getMyRentals,
  getMyRentalListings,
  requestReturn,
  confirmReturn,
  raiseDispute,
} from '../services/rentalService'

const TABS = ['Liked', 'Listed', 'Collections', 'My Rentals', 'Rental Listings', 'Dashboard']

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout, loading } = useAuth()
  const [tab, setTab] = useState('Liked')

  // Dashboard state
  const [dashboardData, setDashboardData]       = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError]     = useState(null)

  // Collections state
  const [collections, setCollections]               = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [collectionsError, setCollectionsError]     = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [selectedColLoading, setSelectedColLoading] = useState(false)

  // Create Collection form modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newColName, setNewColName]           = useState('')
  const [creatingCol, setCreatingCol]         = useState(false)

  // List for Rent Modal state
  const [selectedProductForRent, setSelectedProductForRent] = useState(null)
  const [showRentModal, setShowRentModal]                   = useState(false)

  // My Rentals state (Renter)
  const [myRentals, setMyRentals]               = useState([])
  const [rentalsLoading, setRentalsLoading]     = useState(false)
  const [rentalsError, setRentalsError]         = useState(null)
  const [activeReturnRental, setActiveReturnRental] = useState(null)
  const [returnNotes, setReturnNotes]           = useState('')

  // My Rental Listings state (Seller)
  const [sellerListings, setSellerListings]             = useState([])
  const [sellerListingsLoading, setSellerListingsLoading] = useState(false)
  const [sellerListingsError, setSellerListingsError]   = useState(null)
  const [disputingRentalId, setDisputingRentalId]       = useState(null)
  const [disputeText, setDisputeText]                   = useState('')
  const [submittingDispute, setSubmittingDispute]       = useState(false)

  const uploadedItems = user?.uploadedItems || []
  const likedItems    = user?.likedItems    || []

  useEffect(() => {
    if (!user) return
    if (tab === 'Dashboard') {
      fetchDashboard()
    } else if (tab === 'Collections') {
      fetchCollections()
    } else if (tab === 'My Rentals') {
      fetchRentals()
    } else if (tab === 'Rental Listings') {
      fetchSellerRentalListings()
    }
  }, [tab, user])

  const fetchDashboard = async () => {
    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const res = await getSellerDashboard()
      setDashboardData(res)
    } catch {
      setDashboardError('Could not load seller analytics')
    } finally {
      setDashboardLoading(false)
    }
  }

  const fetchCollections = async () => {
    setCollectionsLoading(true)
    setCollectionsError(null)
    try {
      const res = await getCollections()
      setCollections(Array.isArray(res) ? res : res?.collections || [])
    } catch {
      setCollectionsError('Could not load collections')
    } finally {
      setCollectionsLoading(false)
    }
  }

  const fetchRentals = async () => {
    setRentalsLoading(true)
    setRentalsError(null)
    try {
      const res = await getMyRentals()
      setMyRentals(Array.isArray(res) ? res : res?.rentals || [])
    } catch {
      setRentalsError('Could not load your rentals')
    } finally {
      setRentalsLoading(false)
    }
  }

  const fetchSellerRentalListings = async () => {
    setSellerListingsLoading(true)
    setSellerListingsError(null)
    try {
      const res = await getMyRentalListings()
      setSellerListings(Array.isArray(res) ? res : res?.listings || res?.rentals || [])
    } catch {
      setSellerListingsError('Could not load your rental listings')
    } finally {
      setSellerListingsLoading(false)
    }
  }

  const handleSelectCollection = async (col) => {
    setSelectedColLoading(true)
    try {
      const details = await getCollection(col._id || col.id)
      setSelectedCollection(details || col)
    } catch {
      setSelectedCollection(col)
    } finally {
      setSelectedColLoading(false)
    }
  }

  const handleCreateCollection = async (e) => {
    e.preventDefault()
    if (!newColName.trim()) return
    setCreatingCol(true)
    try {
      await createCollection(newColName.trim())
      setNewColName('')
      setShowCreateModal(false)
      fetchCollections()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create collection')
    } finally {
      setCreatingCol(false)
    }
  }

  const handleRemoveFromCollection = async (productId, e) => {
    e.stopPropagation()
    if (!selectedCollection) return
    if (!window.confirm('Remove this item from collection?')) return

    const colId = selectedCollection._id || selectedCollection.id
    try {
      await removeItemFromCollection(colId, productId)
      const updatedDetails = await getCollection(colId)
      setSelectedCollection(updatedDetails)
      fetchCollections()
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove item')
    }
  }

  const handleDeleteCollection = async (colId, colName, e) => {
    if (e) e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete collection "${colName}"?`)) return

    try {
      await deleteCollection(colId)
      if (selectedCollection && (selectedCollection._id === colId || selectedCollection.id === colId)) {
        setSelectedCollection(null)
      }
      fetchCollections()
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete collection')
    }
  }

  // Handle Renter Return Submission
  const handleReturnPhotosReady = async (urls) => {
    if (!activeReturnRental) return
    try {
      await requestReturn(activeReturnRental._id || activeReturnRental.id, urls, returnNotes)
      setActiveReturnRental(null)
      setReturnNotes('')
      fetchRentals()
    } catch (err) {
      alert(err.response?.data?.message || 'Could not submit return request.')
    }
  }

  // Handle Seller Return Confirmation / Dispute
  const handleConfirmReturnAction = async (rentalId, approved) => {
    if (!approved && !disputeText.trim()) {
      alert('Please enter a dispute reason.')
      return
    }

    setSubmittingDispute(true)
    try {
      await confirmReturn(rentalId, approved, disputeText)
      setDisputingRentalId(null)
      setDisputeText('')
      fetchSellerRentalListings()
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed. Please try again.')
    } finally {
      setSubmittingDispute(false)
    }
  }

  // Handle Mid-rental Dispute Raising
  const handleRaiseMidRentalDispute = async (rentalId) => {
    if (!disputeText.trim()) {
      alert('Please state the issue reason.')
      return
    }

    setSubmittingDispute(true)
    try {
      await raiseDispute(rentalId, disputeText)
      setDisputingRentalId(null)
      setDisputeText('')
      fetchSellerRentalListings()
    } catch (err) {
      alert(err.response?.data?.message || 'Could not raise dispute.')
    } finally {
      setSubmittingDispute(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-pink-50 flex items-center justify-center"><Spinner size="lg" /></div>

  if (!user) return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center pb-24 text-center px-6">
      <div className="text-5xl mb-4">👋</div>
      <h2 className="font-bold text-xl text-gray-800 mb-2">Join Looped</h2>
      <p className="text-gray-500 text-sm mb-6">Sign in to see your profile, liked items, collections, rentals, and seller dashboard</p>
      <button onClick={() => navigate('/login')} className="btn-primary max-w-xs mb-3">Sign In</button>
      <button onClick={() => navigate('/signup')} className="btn-outline max-w-xs">Create Account</button>
    </div>
  )

  const hasListings = uploadedItems.length > 0 || (dashboardData?.totalListings > 0)

  return (
    <div className="min-h-screen bg-pink-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-pink-100 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-bold text-gray-900 text-lg">Profile</h1>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
            Sign out
          </button>
        </div>

        {/* User card */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-lg">{user.name || 'Shopper'}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="flex gap-4 mt-1 text-xs text-gray-500">
              <span><strong className="text-gray-800">{likedItems.length}</strong> liked</span>
              <span><strong className="text-gray-800">{uploadedItems.length}</strong> listed</span>
              <span><strong className="text-gray-800">{user.soldItems || 0}</strong> sold</span>
            </div>
          </div>
        </div>

        {/* Sell button */}
        <button
          onClick={() => navigate('/upload')}
          className="btn-primary mt-4 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          List an Item
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex bg-white border-b border-pink-100 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t !== 'Collections') setSelectedCollection(null)
            }}
            className={`px-3 py-3 text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0
              ${tab === t ? 'text-pink-500 border-b-2 border-pink-500' : 'text-gray-400'}`}
          >
            {t}
            {t === 'Liked' && likedItems.length > 0 && (
              <span className="ml-1 text-[10px] bg-pink-100 text-pink-600 rounded-full px-1.5 py-0.5">
                {likedItems.length}
              </span>
            )}
            {t === 'Collections' && collections.length > 0 && (
              <span className="ml-1 text-[10px] bg-pink-100 text-pink-600 rounded-full px-1.5 py-0.5">
                {collections.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {/* Liked items */}
        {tab === 'Liked' && (
          likedItems.length === 0
            ? <EmptyState icon="❤️" text="No liked items yet" sub="Swipe right on items you love!" action={() => navigate('/swipe')} actionText="Start Swiping" />
            : <div className="grid grid-cols-2 gap-3">
                {likedItems.map(p => <ProductCard key={p._id || p} product={p} />)}
              </div>
        )}

        {/* Listed items */}
        {tab === 'Listed' && (
          uploadedItems.length === 0
            ? <EmptyState icon="👗" text="Nothing listed yet" sub="Start selling your wardrobe!" action={() => navigate('/upload')} actionText="List an Item" />
            : <div className="grid grid-cols-2 gap-3">
                {uploadedItems.map(p => (
                  <div key={p._id || p} className="space-y-1.5">
                    <ProductCard product={p} />
                    <button
                      onClick={() => {
                        setSelectedProductForRent(p)
                        setShowRentModal(true)
                      }}
                      className="w-full bg-pink-100 hover:bg-pink-200 text-pink-700 font-bold text-xs py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <span>👗</span> List for Rent
                    </button>
                  </div>
                ))}
              </div>
        )}

        {/* Collections Tab */}
        {tab === 'Collections' && (
          <div>
            {selectedCollection ? (
              /* Selected Collection Detail View */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white rounded-2xl border border-pink-100 p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedCollection(null)}
                      className="p-1.5 text-gray-500 hover:text-pink-500 rounded-xl hover:bg-pink-50 transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6"/>
                      </svg>
                    </button>
                    <div>
                      <h2 className="font-bold text-gray-900 text-base">{selectedCollection.name}</h2>
                      <p className="text-xs text-gray-400">
                        {(selectedCollection.productIds?.length || selectedCollection.items?.length || 0)} items
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteCollection(selectedCollection._id || selectedCollection.id, selectedCollection.name, e)}
                    className="text-xs text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl font-semibold transition-colors"
                  >
                    Delete Collection
                  </button>
                </div>

                {selectedColLoading ? (
                  <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
                ) : (!selectedCollection.items && !selectedCollection.productIds) || (selectedCollection.items?.length === 0 && selectedCollection.productIds?.length === 0) ? (
                  <EmptyState icon="🖼️" text="Collection is empty" sub="Browse items and tap bookmark to add them here!" action={() => navigate('/')} actionText="Explore Items" />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(selectedCollection.items || selectedCollection.productIds || []).map((product, idx) => {
                      const itemObj = typeof product === 'object' ? product : { _id: product }
                      return (
                        <div key={itemObj._id || idx} className="relative group">
                          <ProductCard product={itemObj} />
                          <button
                            onClick={(e) => handleRemoveFromCollection(itemObj._id, e)}
                            className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-rose-600 text-white rounded-full p-1.5 transition-colors shadow-xs"
                            title="Remove from collection"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Collections List View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-base">Your Collections</h3>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-xs font-bold text-pink-500 bg-pink-100 hover:bg-pink-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                  >
                    <span>+</span> New Collection
                  </button>
                </div>

                {collectionsLoading ? (
                  <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
                ) : collectionsError ? (
                  <div className="bg-rose-50 text-rose-600 text-xs p-4 rounded-2xl border border-rose-100 text-center">
                    {collectionsError}
                  </div>
                ) : collections.length === 0 ? (
                  <EmptyState icon="🔖" text="No collections created" sub="Organize your wishlist into custom collections!" action={() => setShowCreateModal(true)} actionText="Create Collection" />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {collections.map(col => {
                      const itemCount = col.productIds?.length || col.items?.length || 0
                      const coverImg = col.coverImage || col.items?.[0]?.image || col.productIds?.[0]?.image || `https://picsum.photos/seed/${col._id || col.name}/400/500`

                      return (
                        <div
                          key={col._id || col.id}
                          onClick={() => handleSelectCollection(col)}
                          className="card cursor-pointer hover:shadow-md transition-all group overflow-hidden"
                        >
                          <div className="h-36 bg-pink-100 relative overflow-hidden">
                            <img
                              src={coverImg}
                              alt={col.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={e => { e.target.src = `https://picsum.photos/seed/${col.name}/400/500` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <div className="absolute bottom-2 left-3 right-3 text-white">
                              <p className="font-bold text-sm leading-tight drop-shadow-xs">{col.name}</p>
                              <p className="text-[11px] text-white/80">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Rentals Tab (Renter's View) */}
        {tab === 'My Rentals' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 text-base">My Rented Items</h3>

            {rentalsLoading ? (
              <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
            ) : rentalsError ? (
              <div className="bg-rose-50 text-rose-600 text-xs p-4 rounded-2xl border border-rose-100 text-center">
                {rentalsError}
              </div>
            ) : myRentals.length === 0 ? (
              <EmptyState
                icon="🛍️"
                text="No active rentals"
                sub="Explore rentable designer pieces and wear them for a fraction of retail cost!"
                action={() => navigate('/rent')}
                actionText="Explore Rent Feed"
              />
            ) : (
              <div className="space-y-3">
                {myRentals.map(rental => {
                  const product = rental.productId || {}
                  const isRented = rental.status === 'rented'
                  const isDisputed = rental.status === 'disputed'
                  const isReturned = rental.status === 'returned'

                  return (
                    <div key={rental._id || rental.id} className="bg-white rounded-2xl border border-pink-100 p-4 space-y-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <img
                          src={product.image || `https://picsum.photos/seed/${rental._id}/200`}
                          alt={product.title || 'Rental Item'}
                          className="w-16 h-16 rounded-xl object-cover bg-pink-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-gray-900 text-sm truncate">{product.title || 'Fashion Item'}</p>
                            <RentalStatusBadge status={rental.status} />
                          </div>
                          <p className="text-xs text-gray-500">
                            📅 {rental.startDate ? new Date(rental.startDate).toLocaleDateString() : 'Start'} – {rental.endDate ? new Date(rental.endDate).toLocaleDateString() : 'End'}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span>Rent: <strong className="text-pink-600">{formatPrice(rental.rentAmount || 0)}</strong></span>
                            <span>Deposit: <strong className="text-gray-700">{formatPrice(rental.securityDeposit || 0)}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Request Return Flow Trigger */}
                      {isRented && (
                        <button
                          onClick={() => setActiveReturnRental(rental)}
                          className="w-full btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <span>📦</span> Request Return (Upload Condition Photos)
                        </button>
                      )}

                      {/* Disputed Prominent Warning */}
                      {isDisputed && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl space-y-1">
                          <p className="font-bold flex items-center gap-1">⚠️ Return Disputed by Seller</p>
                          {rental.disputeReason && (
                            <p className="text-[11px] text-rose-600 italic">"{rental.disputeReason}"</p>
                          )}
                          <p className="text-[10px] text-rose-500 pt-1 border-t border-rose-100">
                            Under review — contact support for assistance.
                          </p>
                        </div>
                      )}

                      {/* Returned Completion state */}
                      {isReturned && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center justify-between">
                          <span>✓ Rental Completed & Deposit Refunded</span>
                          <button
                            onClick={() => navigate(`/product/${product._id || product.id}`)}
                            className="font-bold text-emerald-900 underline text-[11px]"
                          >
                            Leave Review
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* My Rental Listings Tab (Seller's View) */}
        {tab === 'Rental Listings' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 text-base">Your Rental Listings</h3>

            {sellerListingsLoading ? (
              <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
            ) : sellerListingsError ? (
              <div className="bg-rose-50 text-rose-600 text-xs p-4 rounded-2xl border border-rose-100 text-center">
                {sellerListingsError}
              </div>
            ) : sellerListings.length === 0 ? (
              <EmptyState
                icon="📊"
                text="No active rental listings"
                sub="List your wardrobe items for rent to start earning daily rental income!"
                action={() => setTab('Listed')}
                actionText="List Items for Rent"
              />
            ) : (
              <div className="space-y-4">
                {sellerListings.map(rental => {
                  const product = rental.productId || {}
                  const renter = rental.renterId || {}
                  const isReturnPending = rental.status === 'return_pending'
                  const isRented = rental.status === 'rented'
                  const isDisputingThis = disputingRentalId === (rental._id || rental.id)

                  return (
                    <div key={rental._id || rental.id} className="bg-white rounded-2xl border border-pink-100 p-4 space-y-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <img
                          src={product.image || `https://picsum.photos/seed/${rental._id}/200`}
                          alt={product.title || 'Item'}
                          className="w-16 h-16 rounded-xl object-cover bg-pink-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-gray-900 text-sm truncate">{product.title || 'Rental Item'}</p>
                            <RentalStatusBadge status={rental.status} />
                          </div>
                          <p className="text-xs text-gray-600">
                            👤 Renter: <strong>{renter.name || renter.email || 'Anonymous Renter'}</strong>
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            📅 {rental.startDate ? new Date(rental.startDate).toLocaleDateString() : 'Start'} – {rental.endDate ? new Date(rental.endDate).toLocaleDateString() : 'End'}
                          </p>
                        </div>
                      </div>

                      {/* Return Pending — Condition Photo Comparison (Before vs After) */}
                      {isReturnPending && (
                        <div className="bg-pink-50/70 border border-pink-100 rounded-2xl p-3 space-y-3">
                          <p className="text-xs font-bold text-gray-900">🔍 Condition Comparison (Before vs After Return)</p>

                          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                            <div>
                              <p className="font-semibold text-gray-600 mb-1">Before Rental</p>
                              <div className="flex gap-1 overflow-x-auto">
                                {(rental.conditionImagesBefore || [product.image]).map((img, i) => (
                                  <img key={i} src={img} alt="Before" className="w-14 h-14 object-cover rounded-lg bg-white border border-gray-200" />
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="font-semibold text-gray-600 mb-1">After Return</p>
                              <div className="flex gap-1 overflow-x-auto">
                                {(rental.conditionImagesAfter || []).map((img, i) => (
                                  <img key={i} src={img} alt="After" className="w-14 h-14 object-cover rounded-lg bg-white border border-pink-200" />
                                ))}
                              </div>
                            </div>
                          </div>

                          {rental.conditionNotesAfter && (
                            <p className="text-xs text-gray-600 italic bg-white p-2 rounded-xl border border-pink-100">
                              Renter Notes: "{rental.conditionNotesAfter}"
                            </p>
                          )}

                          {isDisputingThis ? (
                            <div className="space-y-2 pt-2 border-t border-pink-100">
                              <textarea
                                value={disputeText}
                                onChange={e => setDisputeText(e.target.value)}
                                placeholder="Specify damage, stain, or missing item reason..."
                                rows={2}
                                className="input text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDisputingRentalId(null)}
                                  className="btn-outline flex-1 py-2 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleConfirmReturnAction(rental._id || rental.id, false)}
                                  disabled={submittingDispute || !disputeText.trim()}
                                  className="bg-rose-600 text-white font-bold text-xs flex-1 py-2 rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  {submittingDispute ? <Spinner size="sm" /> : 'Submit Dispute'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleConfirmReturnAction(rental._id || rental.id, true)}
                                className="bg-emerald-600 text-white text-xs font-bold flex-1 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
                              >
                                ✓ Confirm Return (Release Deposit)
                              </button>
                              <button
                                onClick={() => setDisputingRentalId(rental._id || rental.id)}
                                className="bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-rose-200 transition-colors"
                              >
                                Dispute
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Rental — Raise Issue action */}
                      {isRented && (
                        <div className="pt-1">
                          {isDisputingThis ? (
                            <div className="space-y-2 bg-rose-50 p-3 rounded-2xl border border-rose-100">
                              <p className="text-xs font-bold text-rose-800">Raise Rental Issue</p>
                              <textarea
                                value={disputeText}
                                onChange={e => setDisputeText(e.target.value)}
                                placeholder="Describe problem (e.g. unreturned, late, damaged)..."
                                rows={2}
                                className="input text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDisputingRentalId(null)}
                                  className="btn-outline flex-1 py-2 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleRaiseMidRentalDispute(rental._id || rental.id)}
                                  disabled={submittingDispute || !disputeText.trim()}
                                  className="bg-rose-600 text-white font-bold text-xs flex-1 py-2 rounded-xl hover:bg-rose-700"
                                >
                                  {submittingDispute ? <Spinner size="sm" /> : 'Raise Dispute'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDisputingRentalId(rental._id || rental.id)}
                              className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                            >
                              ⚠️ Raise an Issue with this Rental
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Seller dashboard */}
        {tab === 'Dashboard' && (
          <div className="space-y-4">
            {!hasListings ? (
              <EmptyState
                icon="📊"
                text="No seller analytics yet"
                sub="List your first item to start tracking views, likes, and reviews!"
                action={() => navigate('/upload')}
                actionText="List an Item"
              />
            ) : dashboardLoading ? (
              <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
            ) : dashboardError ? (
              <div className="bg-rose-50 text-rose-600 text-xs p-4 rounded-2xl border border-rose-100 text-center">
                {dashboardError}
              </div>
            ) : (
              <>
                <h3 className="font-bold text-gray-800">Seller Analytics</h3>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    icon="📦"
                    label="Total Listings"
                    value={dashboardData?.totalListings ?? uploadedItems.length}
                  />
                  <StatCard
                    icon="👁️"
                    label="Total Views"
                    value={dashboardData?.totalViews ?? uploadedItems.reduce((s, i) => s + (i.views || 0), 0)}
                  />
                  <StatCard
                    icon="❤️"
                    label="Total Likes"
                    value={dashboardData?.totalLikes ?? uploadedItems.reduce((s, i) => s + (i.likes || 0), 0)}
                  />
                  <StatCard
                    icon="✅"
                    label="Items Sold"
                    value={dashboardData?.soldItems ?? user.soldItems ?? 0}
                  />
                </div>

                {/* Seller Rating Card */}
                <div className="bg-white rounded-2xl border border-pink-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Seller Rating</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-gray-900 text-xl">
                        {(dashboardData?.avgSellerRating ?? 5.0).toFixed(1)}
                      </span>
                      <StarRating rating={dashboardData?.avgSellerRating ?? 5.0} size="sm" />
                    </div>
                  </div>
                  <span className="text-xs bg-pink-100 text-pink-600 font-semibold px-3 py-1.5 rounded-full">
                    {dashboardData?.sellerReviewCount ?? 0} reviews
                  </span>
                </div>

                {/* Top Listings mini-list */}
                {dashboardData?.topListings?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-pink-100 p-4 space-y-3">
                    <p className="font-bold text-gray-800 text-sm">🔥 Top Listings</p>
                    <div className="space-y-2">
                      {dashboardData.topListings.map(item => (
                        <div
                          key={item._id}
                          onClick={() => navigate(`/product/${item._id}`)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-pink-50 cursor-pointer transition-colors"
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-12 h-12 rounded-lg object-cover bg-pink-50"
                            onError={e => { e.target.src = `https://picsum.photos/seed/${item._id}/200` }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                            <p className="text-xs font-bold text-pink-600">{formatPrice(item.price)}</p>
                          </div>
                          <div className="text-right text-[11px] text-gray-400 space-x-2">
                            <span>👁 {item.views || 0}</span>
                            <span>❤️ {item.likes || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Reviews mini-list */}
                {dashboardData?.recentReviews?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-pink-100 p-4 space-y-3">
                    <p className="font-bold text-gray-800 text-sm">⭐ Recent Reviews</p>
                    <div className="space-y-2">
                      {dashboardData.recentReviews.map(review => (
                        <div key={review._id} className="p-2.5 rounded-xl bg-pink-50/50 border border-pink-50 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-800">{review.userName || 'Buyer'}</span>
                            <StarRating rating={review.rating} size="sm" />
                          </div>
                          {review.productTitle && (
                            <p className="text-[10px] text-pink-600 font-semibold">For: {review.productTitle}</p>
                          )}
                          {review.comment && (
                            <p className="text-xs text-gray-600 italic">"{truncate(review.comment, 80)}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => navigate('/upload')} className="btn-primary">+ List New Item</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* New Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-pink-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base">New Collection</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreateCollection} className="space-y-3">
              <input
                type="text"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                placeholder="Collection Name (e.g. Vintage Denim)"
                className="input"
                autoFocus
                required
              />
              <button
                type="submit"
                disabled={creatingCol || !newColName.trim()}
                className="btn-primary py-3 text-sm flex items-center justify-center"
              >
                {creatingCol ? <Spinner size="sm" /> : 'Create Collection'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* List for Rent Modal */}
      <ListForRentModal
        product={selectedProductForRent}
        isOpen={showRentModal}
        onClose={() => {
          setShowRentModal(false)
          setSelectedProductForRent(null)
        }}
        onSuccess={() => {
          fetchSellerRentalListings()
          setTab('Rental Listings')
        }}
      />

      {/* Request Return Modal (Renter flow) */}
      {activeReturnRental && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-pink-100 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Request Return</h3>
                <p className="text-xs text-gray-400">{activeReturnRental.productId?.title}</p>
              </div>
              <button onClick={() => setActiveReturnRental(null)} className="text-gray-400 hover:text-gray-600 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-800">Return Condition Notes (Optional)</label>
              <textarea
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                placeholder="Mention return condition details..."
                rows={2}
                className="input text-xs"
              />

              <ConditionPhotoUpload onPhotosReady={handleReturnPhotosReady} minPhotos={3} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-pink-100 p-4 text-center">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="font-bold text-gray-900 text-xl">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

function EmptyState({ icon, text, sub, action, actionText }) {
  return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-semibold text-gray-700 mb-1">{text}</p>
      <p className="text-gray-400 text-sm mb-5">{sub}</p>
      <button onClick={action} className="btn-primary max-w-xs mx-auto">{actionText}</button>
    </div>
  )
}
