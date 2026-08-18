import { useState, useRef } from 'react'
import { runLocalChecks, createPreviewUrl, formatFileSize } from '../utils/imageQuality'
import { uploadMultipleImages } from '../services/uploadService'
import Spinner from './Spinner'

export default function ConditionPhotoUpload({ onPhotosReady, minPhotos = 3 }) {
  // Array of { file, previewUrl, issues: [], status: 'ok'|'warn'|'block' }
  const [photoItems, setPhotoItems] = useState([])
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadError(null)

    const processed = await Promise.all(
      files.map(async (file) => {
        const previewUrl = createPreviewUrl(file)
        const checkResult = await runLocalChecks(file)
        return {
          file,
          previewUrl,
          blocks: checkResult.blocks || [],
          warnings: checkResult.warnings || [],
          passed: checkResult.passed,
        }
      })
    )

    setPhotoItems(prev => [...prev, ...processed])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemovePhoto = (index) => {
    setPhotoItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleUploadAndSubmit = async () => {
    const validItems = photoItems.filter(item => item.passed)
    if (validItems.length < minPhotos) {
      setUploadError(`Please upload at least ${minPhotos} clear condition photos.`)
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // Structure photo map as expected by uploadMultipleImages: { 1: { file }, 2: { file }, ... }
      const completedPhotos = {}
      validItems.forEach((item, idx) => {
        completedPhotos[idx + 1] = { file: item.file }
      })

      const urls = await uploadMultipleImages(completedPhotos)
      if (!urls || urls.length < minPhotos) {
        throw new Error(`Upload returned fewer than ${minPhotos} photo URLs.`)
      }
      onPhotosReady(urls)
    } catch (err) {
      setUploadError(err.message || 'Failed to upload condition photos. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const validCount = photoItems.filter(item => item.passed).length

  return (
    <div className="space-y-3 bg-pink-50/50 rounded-2xl border border-pink-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-800">Condition Photos (Min {minPhotos})</p>
          <p className="text-[11px] text-gray-500">Show seams, fabric, front, back, and any wear detail.</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${validCount >= minPhotos ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {validCount} / {minPhotos} photos
        </span>
      </div>

      {/* Grid of uploaded thumbnails */}
      <div className="grid grid-cols-3 gap-2">
        {photoItems.map((item, idx) => (
          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
            <img src={item.previewUrl} alt={`Condition ${idx + 1}`} className="w-full h-full object-cover" />

            {/* Quality status badge */}
            {!item.passed ? (
              <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center p-1 text-center">
                <span className="text-white text-xs font-bold">🚫 Too Blurry/Dark</span>
                <p className="text-[9px] text-red-100 leading-tight mt-0.5">{item.blocks[0]?.message}</p>
              </div>
            ) : item.warnings.length > 0 ? (
              <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                ⚠️ Soft Warning
              </div>
            ) : null}

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemovePhoto(idx)}
              className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
              title="Remove photo"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}

        {/* Add photo tile */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-pink-300 hover:border-pink-500 bg-white hover:bg-pink-50 text-pink-500 flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <span className="text-xl">+</span>
          <span className="text-[10px] font-semibold">Add Photo</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      {uploadError && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
          {uploadError}
        </div>
      )}

      {/* Upload button action */}
      <button
        type="button"
        onClick={handleUploadAndSubmit}
        disabled={uploading || validCount < minPhotos}
        className="w-full btn-primary py-2.5 text-xs flex items-center justify-center gap-2"
      >
        {uploading ? <Spinner size="sm" /> : `Confirm ${validCount} Condition Photo${validCount === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}
