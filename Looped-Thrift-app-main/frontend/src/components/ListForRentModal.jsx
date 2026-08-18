import { useState } from 'react'
import ConditionPhotoUpload from './ConditionPhotoUpload'
import RentPriceSuggestion from './RentPriceSuggestion'
import Spinner from './Spinner'
import { listForRent } from '../services/rentalService'
import { formatPrice } from '../utils/helpers'

export default function ListForRentModal({ product, isOpen, onClose, onSuccess }) {
  const [step, setStep]                       = useState(1) // 1: Photos, 2: Rental Terms, 3: Success Guidance
  const [conditionImages, setConditionImages] = useState([])
  const [rentPricePerDay, setRentPricePerDay] = useState('')
  const [securityDeposit, setSecurityDeposit] = useState('')
  const [conditionNotes, setConditionNotes]   = useState('')

  const [submitting, setSubmitting]   = useState(false)
  const [errorList, setErrorList]     = useState([])
  const [priceGuidance, setPriceGuidance] = useState('')

  if (!isOpen || !product) return null

  const handlePhotosReady = (urls) => {
    setConditionImages(urls)
    setStep(2)
  }

  const handleAcceptSuggestion = (suggestedRent, suggestedDeposit) => {
    setRentPricePerDay(String(suggestedRent))
    if (suggestedDeposit) setSecurityDeposit(String(suggestedDeposit))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rentPricePerDay || !securityDeposit) {
      setErrorList(['Please provide both daily rent rate and security deposit amount.'])
      return
    }

    setSubmitting(true)
    setErrorList([])

    try {
      const res = await listForRent({
        productId: product._id || product.id,
        rentPricePerDay,
        securityDeposit,
        conditionImages,
        conditionNotes,
      })

      if (res.priceGuidance) {
        setPriceGuidance(res.priceGuidance)
      } else {
        setPriceGuidance('Your item is now live on the Rent Feed! 🎉')
      }
      setStep(3)
    } catch (err) {
      const backendErrors = err.response?.data?.errors || err.response?.data?.message
      if (Array.isArray(backendErrors)) {
        setErrorList(backendErrors)
      } else if (typeof backendErrors === 'string') {
        setErrorList([backendErrors])
      } else {
        setErrorList(['Failed to list item for rent. Please check all fields and try again.'])
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setConditionImages([])
    setRentPricePerDay('')
    setSecurityDeposit('')
    setConditionNotes('')
    setErrorList([])
    setPriceGuidance('')
    onClose()
    if (step === 3 && onSuccess) onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-pink-100 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pink-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">👗</span>
            <div>
              <h3 className="font-bold text-gray-900 text-base">List for Rent</h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{product.title}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 font-bold p-1">✕</button>
        </div>

        {/* Errors list */}
        {errorList.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl space-y-1">
            <p className="font-bold text-rose-800">Please fix the following:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {errorList.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 1: Condition Photos */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              Renters need proof of the item's current condition before renting. Upload at least 3 clear photos.
            </p>
            <ConditionPhotoUpload onPhotosReady={handlePhotosReady} minPhotos={3} />
          </div>
        )}

        {/* Step 2: Rent Terms & Pricing */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* AI Suggestion component */}
            <RentPriceSuggestion
              brand={product.brand}
              category={product.category}
              condition={product.condition}
              originalPrice={product.originalPrice}
              resalePrice={product.price}
              onAccept={handleAcceptSuggestion}
            />

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">Daily Rent Price (₹/day)</label>
              <input
                type="number"
                value={rentPricePerDay}
                onChange={e => setRentPricePerDay(e.target.value)}
                placeholder="e.g. 250"
                className="input text-xs"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">Security Deposit (₹)</label>
              <input
                type="number"
                value={securityDeposit}
                onChange={e => setSecurityDeposit(e.target.value)}
                placeholder="e.g. 1000"
                className="input text-xs"
                required
                min="0"
              />
              <p className="text-[10px] text-gray-400 mt-1">Fully refundable to renter upon safe return.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">Condition Notes (Optional)</label>
              <textarea
                value={conditionNotes}
                onChange={e => setConditionNotes(e.target.value)}
                placeholder="Mention minor wear, zipper condition, special care, etc."
                rows={2}
                className="input text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-outline flex-1 py-2.5 text-xs"
              >
                Back to Photos
              </button>
              <button
                type="submit"
                disabled={submitting || !rentPricePerDay || !securityDeposit}
                className="btn-primary flex-1 py-2.5 text-xs flex items-center justify-center gap-1"
              >
                {submitting ? <Spinner size="sm" /> : 'Publish Listing'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success & AI Guidance Feedback */}
        {step === 3 && (
          <div className="text-center py-4 space-y-4">
            <div className="text-4xl">✨</div>
            <h4 className="font-bold text-gray-900 text-lg">Item Listed for Rent!</h4>
            <div className="bg-pink-50 border border-pink-100 p-4 rounded-2xl text-xs text-pink-800 leading-relaxed font-medium">
              {priceGuidance}
            </div>
            <button
              onClick={handleClose}
              className="btn-primary w-full py-3 text-xs font-bold"
            >
              Done & View Listings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
