import { useState, useEffect } from 'react'

export default function CheckoutAddressStep({
  user,
  address,
  onAddressSelect,
  onNext,
  disabled
}) {
  const storageKey = `looped_addresses_${user?.id || user?._id || user?.email || 'guest'}`

  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: address?.name || user?.name || '',
    phone: address?.phone || user?.phone || '',
    address: address?.address || '',
    city: address?.city || '',
    state: address?.state || '',
    pincode: address?.pincode || '',
    saveForLater: true
  })

  // Load saved addresses on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedAddresses(parsed)
          setSelectedId(parsed[0].id)
          onAddressSelect(parsed[0])
          return
        }
      }
    } catch (e) {
      console.warn('Could not read saved addresses', e)
    }

    // If no saved addresses, default to show add form
    setShowAddForm(true)
  }, [storageKey])

  const handleSelectExisting = (addr) => {
    setSelectedId(addr.id)
    onAddressSelect(addr)
    setShowAddForm(false)
    setError('')
  }

  const handleFormChange = (field) => (e) => {
    const val = field === 'saveForLater' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [field]: val }))
    if (error) setError('')
  }

  const handleSaveAndUseNew = (e) => {
    e.preventDefault()
    setError('')

    // Client-side Validation
    if (!form.name.trim()) {
      setError('Please enter your full recipient name.')
      return
    }
    const cleanPhone = form.phone.replace(/[^0-9]/g, '')
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }
    if (!form.address.trim() || form.address.trim().length < 8) {
      setError('Please provide a complete street address with house/flat number.')
      return
    }
    if (!form.city.trim() || !form.state.trim()) {
      setError('Please enter your city and state.')
      return
    }
    const cleanPin = form.pincode.replace(/[^0-9]/g, '')
    if (cleanPin.length !== 6) {
      setError('Please enter a valid 6-digit postal pincode.')
      return
    }

    const newAddress = {
      id: `addr_${Date.now()}`,
      name: form.name.trim(),
      phone: cleanPhone,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: cleanPin
    }

    if (form.saveForLater) {
      const updated = [newAddress, ...savedAddresses.filter(a => a.id !== newAddress.id)]
      setSavedAddresses(updated)
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
      } catch (err) {
        console.warn('Could not persist address', err)
      }
    }

    setSelectedId(newAddress.id)
    onAddressSelect(newAddress)
    setShowAddForm(false)
    onNext()
  }

  const handleProceedExisting = () => {
    const selected = savedAddresses.find(a => a.id === selectedId)
    if (!selected) {
      setError('Please select or add a delivery address.')
      return
    }
    onAddressSelect(selected)
    onNext()
  }

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <span>📍</span> Select Delivery Address
          </h3>
          <p className="text-[11px] text-gray-500">Orders are shipped with eco-friendly packaging</p>
        </div>
        {savedAddresses.length > 0 && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-xs text-pink-600 font-bold hover:underline flex items-center gap-1"
          >
            <span>+</span> Add New
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl animate-shake">
          {error}
        </div>
      )}

      {/* Saved Addresses Radio List (Amazon Style) */}
      {!showAddForm && savedAddresses.length > 0 && (
        <div className="space-y-2.5">
          {savedAddresses.map((addr, idx) => {
            const isSelected = selectedId === addr.id

            return (
              <div
                key={addr.id}
                onClick={() => handleSelectExisting(addr)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${isSelected
                    ? 'border-pink-500 bg-pink-50/50 ring-1 ring-pink-500 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-pink-200'
                  }`}
              >
                <input
                  type="radio"
                  name="savedAddress"
                  checked={isSelected}
                  onChange={() => handleSelectExisting(addr)}
                  className="mt-1 accent-pink-500 w-4 h-4"
                />
                <div className="flex-1 min-w-0 text-xs text-gray-600">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-900 text-sm">{addr.name}</span>
                    {idx === 0 && (
                      <span className="bg-pink-100 text-pink-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-700">{addr.address}</p>
                  <p className="text-gray-500">{addr.city}, {addr.state} - {addr.pincode}</p>
                  <p className="text-gray-500 mt-1 flex items-center gap-1">
                    <span>📞</span> {addr.phone}
                  </p>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={handleProceedExisting}
            disabled={disabled}
            className="btn-primary w-full py-3 mt-3 text-sm font-bold flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Deliver to this Address</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* Add / Edit Address Form */}
      {showAddForm && (
        <form onSubmit={handleSaveAndUseNew} className="bg-white rounded-2xl border border-pink-100 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-pink-50">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Enter New Shipping Address
            </span>
            {savedAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Full Name <span className="text-pink-500">*</span>
              </label>
              <input
                className="input text-xs"
                placeholder="e.g. Aditi Sharma"
                value={form.name}
                onChange={handleFormChange('name')}
                disabled={disabled}
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Mobile Number <span className="text-pink-500">*</span>
              </label>
              <input
                className="input text-xs"
                type="tel"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={handleFormChange('phone')}
                disabled={disabled}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-700 block mb-1">
              Street Address / House & Flat No. <span className="text-pink-500">*</span>
            </label>
            <textarea
              className="input text-xs h-18 resize-none py-2"
              placeholder="Flat/House No., Building, Street name, Area, Landmark"
              value={form.address}
              onChange={handleFormChange('address')}
              disabled={disabled}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                City <span className="text-pink-500">*</span>
              </label>
              <input
                className="input text-xs px-2.5"
                placeholder="Bengaluru"
                value={form.city}
                onChange={handleFormChange('city')}
                disabled={disabled}
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                State <span className="text-pink-500">*</span>
              </label>
              <input
                className="input text-xs px-2.5"
                placeholder="Karnataka"
                value={form.state}
                onChange={handleFormChange('state')}
                disabled={disabled}
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Pincode <span className="text-pink-500">*</span>
              </label>
              <input
                className="input text-xs px-2.5"
                type="text"
                maxLength={6}
                placeholder="560034"
                value={form.pincode}
                onChange={handleFormChange('pincode')}
                disabled={disabled}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.saveForLater}
              onChange={handleFormChange('saveForLater')}
              className="accent-pink-500 rounded"
            />
            <span className="text-xs text-gray-600">Save this address for fast checkout next time</span>
          </label>

          <button
            type="submit"
            disabled={disabled}
            className="btn-primary w-full py-3 mt-2 text-sm font-bold flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Save & Use Address</span>
            <span>→</span>
          </button>
        </form>
      )}
    </div>
  )
}
