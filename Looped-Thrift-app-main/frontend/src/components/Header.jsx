import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { uploadImage } from '../services/uploadService'
import api from '../services/api'

export default function Header({ onSearch }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cartItems } = useCart()
  const [q, setQ] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleSearch = (e) => {
    e.preventDefault()
    if (onSearch) onSearch(q)
    else navigate(`/discover?search=${encodeURIComponent(q)}`)
  }

  const handleCameraPhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const imageUrl = await uploadImage(file)
      // Navigate directly to discover page with imageUrl parameter to display visual search results on grid
      navigate(`/discover?imageUrl=${encodeURIComponent(imageUrl)}`)
    } catch (err) {
      console.error('Failed photo search from header:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-pink-100 px-3 py-2.5 shadow-2xs font-sans">
      {/* Hidden File Input for Visual Search */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleCameraPhotoUpload}
        className="hidden"
      />

      <div className="flex items-center gap-2 max-w-lg mx-auto">

        {/* ── Logo: L + SVG infinity as "oo" + ped ── */}
        <button
          onClick={() => navigate('/')}
          className="flex-shrink-0 flex items-center leading-none"
          style={{ fontFamily: '"DM Serif Display", serif' }}
        >
          <span className="text-pink-500 italic text-2xl tracking-tight flex items-center">
            L
            <svg
              viewBox="0 0 38 22"
              width="28"
              height="16"
              className="inline-block mx-0.5"
              style={{ verticalAlign: 'middle', marginBottom: '1px' }}
            >
              <path
                d="M9 11 C9 6.5 13 4 17.5 7 L19 9 L20.5 7 C25 4 29 6.5 29 11 C29 15.5 25 18 20.5 15 L19 13 L17.5 15 C13 18 9 15.5 9 11 Z"
                fill="none"
                stroke="#ec4899"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            ped
          </span>
        </button>

        {/* ── Search bar with Camera Upload Icon on Home Page ── */}
        <form onSubmit={handleSearch} className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>

            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full bg-pink-50 border border-pink-200 rounded-full
                         pl-8 pr-9 py-2 text-sm focus:outline-none focus:ring-2
                         focus:ring-pink-300 placeholder-gray-400 transition"
              placeholder="Search styles or tap 📷..."
            />

            {/* 📷 Home Page Camera Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-pink-500 hover:text-pink-600 transition active:scale-95 disabled:opacity-50"
              title="Search by Photo (Visual Search)"
            >
              {uploading ? (
                <div className="w-3.5 h-3.5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-base select-none">📷</span>
              )}
            </button>
          </div>
        </form>

        {/* ── Chat icon ── */}
        <button
          onClick={() => navigate('/chat')}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                     hover:bg-pink-50 transition-colors"
          aria-label="Chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        {/* ── Cart icon with badge ── */}
        <button
          onClick={() => navigate('/cart')}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                     hover:bg-pink-50 transition-colors relative"
          aria-label="Cart"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          {cartItems.length > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-pink-500 text-white
                             text-[9px] font-bold w-4 h-4 rounded-full
                             flex items-center justify-center leading-none">
              {cartItems.length}
            </span>
          )}
        </button>

        {/* ── Profile avatar ── */}
        <button
          onClick={() => navigate('/profile')}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-pink-100 flex items-center
                     justify-center hover:bg-pink-200 transition-colors overflow-hidden"
          aria-label="Profile"
        >
          {user?.avatar ? (
            <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
          ) : (
            <span className="text-pink-600 font-bold text-sm select-none">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </button>

      </div>
    </header>
  )
}
