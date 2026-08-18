import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Spinner from './Spinner'
import { useAuth } from '../context/AuthContext'
import { getCollections, createCollection, addItemToCollection } from '../services/collectionService'

export default function SaveToCollectionModal({ productId, isOpen, onClose }) {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [collections, setCollections] = useState([])
  const [loading, setLoading]         = useState(false)
  const [savingId, setSavingId]       = useState(null)
  const [error, setError]             = useState(null)
  const [successMsg, setSuccessMsg]   = useState(null)

  // New collection form state
  const [showCreate, setShowCreate]   = useState(false)
  const [newColName, setNewColName]   = useState('')
  const [creating, setCreating]       = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (!token) {
        onClose()
        navigate('/login')
        return
      }
      fetchCollections()
    } else {
      setShowCreate(false)
      setNewColName('')
      setSuccessMsg(null)
      setError(null)
    }
  }, [isOpen, token])

  const fetchCollections = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCollections()
      setCollections(Array.isArray(data) ? data : data?.collections || [])
    } catch (err) {
      setError('Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToCollection = async (collectionId) => {
    setSavingId(collectionId)
    setError(null)
    setSuccessMsg(null)
    try {
      await addItemToCollection(collectionId, productId)
      setSuccessMsg('Added to collection! ✨')
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save item to collection')
    } finally {
      setSavingId(null)
    }
  }

  const handleCreateAndSave = async (e) => {
    e.preventDefault()
    if (!newColName.trim()) return
    setCreating(true)
    setError(null)
    try {
      // Create collection with optional initial productId or create then add
      const newCol = await createCollection(newColName.trim(), productId)
      if (newCol && !newCol.productIds?.includes(productId)) {
        await addItemToCollection(newCol._id || newCol.id, productId)
      }
      setSuccessMsg(`Created & saved to "${newColName.trim()}"! ✨`)
      setNewColName('')
      setShowCreate(false)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create collection')
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-xl border border-pink-100 z-10 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔖</span>
            <h3 className="font-bold text-gray-900 text-base">Save to Collection</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-lg font-bold">
            ✕
          </button>
        </div>

        {/* Success message banner */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-xl mb-3 flex items-center gap-2">
            <span>✓</span> {successMsg}
          </div>
        )}

        {/* Error message banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs px-3 py-2 rounded-xl mb-3">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-8 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {collections.length === 0 && !showCreate ? (
              <div className="text-center py-6 text-gray-400">
                <p className="text-sm mb-2">No collections yet</p>
                <p className="text-xs text-gray-400">Create one below to save this item!</p>
              </div>
            ) : (
              collections.map(col => {
                const count = col.productIds?.length || col.items?.length || 0
                const isSaving = savingId === (col._id || col.id)
                return (
                  <button
                    key={col._id || col.id}
                    onClick={() => handleSaveToCollection(col._id || col.id)}
                    disabled={isSaving}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-pink-100 bg-pink-50/50 hover:bg-pink-100/60 active:scale-98 transition-all text-left group"
                  >
                    <div>
                      <p className="font-bold text-sm text-gray-800 group-hover:text-pink-600 transition-colors">
                        {col.name}
                      </p>
                      <p className="text-xs text-gray-400">{count} {count === 1 ? 'item' : 'items'}</p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 bg-white text-pink-500 rounded-full border border-pink-200 shadow-2xs group-hover:bg-pink-500 group-hover:text-white transition-all">
                      {isSaving ? <Spinner size="sm" /> : '+ Save'}
                    </span>
                  </button>
                )
              })
            )}

            {/* Create new collection section */}
            {showCreate ? (
              <form onSubmit={handleCreateAndSave} className="mt-3 pt-3 border-t border-pink-100 space-y-2">
                <p className="text-xs font-semibold text-gray-700">New Collection Name</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    placeholder="e.g. Summer Outfits"
                    autoFocus
                    className="input flex-1 py-2 text-xs"
                    required
                  />
                  <button
                    type="submit"
                    disabled={creating || !newColName.trim()}
                    className="px-4 py-2 bg-pink-500 text-white font-semibold text-xs rounded-xl hover:bg-pink-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {creating ? <Spinner size="sm" /> : 'Create & Save'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full mt-2 py-2.5 px-4 rounded-2xl border-2 border-dashed border-pink-300 text-pink-500 hover:bg-pink-50 font-semibold text-xs transition-colors flex items-center justify-center gap-1"
              >
                <span>+</span> Create New Collection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
