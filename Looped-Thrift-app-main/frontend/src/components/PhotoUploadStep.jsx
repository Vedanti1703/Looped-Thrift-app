// ─────────────────────────────────────────────────────────────
//  PhotoUploadStep.jsx
//  Handles one photo step: pick file → local checks → Vision API
//  → show results → let user retake or confirm
// ─────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import { runLocalChecks, createPreviewUrl, formatFileSize } from '../utils/imageQuality'
import { analyseWithVision, validateShotType } from '../services/visionService'
import Spinner from './Spinner'

const STEP_INFO = {
  1: {
    label:    'Front View',
    icon:     '👕',
    required: true,
    hint:     'Lay flat on a clean surface or hang. Show the full front of the item. Good lighting.',
    example:  'Full garment, front facing, clean background',
  },
  2: {
    label:    'Back View',
    icon:     '🔄',
    required: true,
    hint:     'Same setup as front — show the complete back of the item.',
    example:  'Full garment, back facing',
  },
  3: {
    label:    'Fabric Closeup',
    icon:     '🔍',
    required: true,
    hint:     'Get close to the fabric — show texture, print detail, or any wear marks.',
    example:  'Macro shot of fabric texture',
  },
  4: {
    label:    'On-Model Shot',
    icon:     '👤',
    required: false,
    hint:     'Optional but gets 3× more buyer interest! Show the item being worn.',
    example:  'Item worn by a person',
  },
}

export default function PhotoUploadStep({ step, onComplete, onSkip, existingFile }) {
  const info    = STEP_INFO[step]
  const fileRef = useRef(null)

  const [file,          setFile]          = useState(existingFile || null)
  const [previewUrl,    setPreviewUrl]    = useState(existingFile ? createPreviewUrl(existingFile) : null)
  const [status,        setStatus]        = useState(existingFile ? 'done' : 'idle')
  // status: idle | checking | warning | done | error

  const [localIssues,   setLocalIssues]   = useState([])
  const [visionResult,  setVisionResult]  = useState(null)
  const [shotWarnings,  setShotWarnings]  = useState([])
  const [autoTags,      setAutoTags]      = useState([])
  const [damageAcked,   setDamageAcked]   = useState(false)

  // ── Pick a file ───────────────────────────────────────────
  const handleFilePick = async (e) => {
    const picked = e.target.files?.[0]
    if (!picked) return

    // Reset state
    setLocalIssues([])
    setVisionResult(null)
    setShotWarnings([])
    setAutoTags([])
    setDamageAcked(false)
    setStatus('checking')

    const url = createPreviewUrl(picked)
    setFile(picked)
    setPreviewUrl(url)

    // ── Step 1: local canvas checks (instant) ──────────────
    const localResult = await runLocalChecks(picked)

    // Hard blocks (truly unusable image) → force retake
    if (localResult.blocks?.length > 0) {
      setLocalIssues(localResult.blocks)
      setStatus('warning')
      return
    }

    // Soft warnings (slightly dark, slightly soft) → show but don't block
    // Collect them to display alongside Vision results
    const softWarnings = localResult.warnings || []

    // ── Step 2: Vision API ────────────────────────────────
    setStatus('checking')
    const vision = await analyseWithVision(picked)
    setVisionResult(vision)

    const shotW = validateShotType(vision, step)
    // Merge soft local warnings into shot warnings so they show together
    setShotWarnings([...softWarnings.map(w => w.message), ...shotW])

    if (vision.autoTags?.length > 0) setAutoTags(vision.autoTags)

    // Show warning state only if there are real issues worth flagging
    const hasWarnings =
      vision.damageWarnings?.length > 0 ||
      shotW.length > 0
      // Note: soft local warnings alone don't force warning state anymore

    setStatus(hasWarnings ? 'warning' : 'done')
  }

  const handleRetake = () => {
    setFile(null)
    setPreviewUrl(null)
    setStatus('idle')
    setLocalIssues([])
    setVisionResult(null)
    setShotWarnings([])
    setAutoTags([])
    setDamageAcked(false)
    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleConfirm = () => {
    onComplete({ file, previewUrl, autoTags, visionResult })
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Step header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-xl flex-shrink-0">
          {info.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800">{info.label}</h3>
            {!info.required && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Optional
              </span>
            )}
            {info.required && (
              <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-medium">
                Required
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{info.example}</p>
        </div>
      </div>

      {/* Hint box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex gap-2">
        <span className="text-blue-400 text-sm mt-0.5">💡</span>
        <p className="text-xs text-blue-700 leading-relaxed">{info.hint}</p>
      </div>

      {/* Upload area */}
      {status === 'idle' && (
        <label className="block cursor-pointer">
          <div className="w-full h-48 rounded-2xl border-2 border-dashed border-pink-300
                          bg-pink-50 flex flex-col items-center justify-center
                          hover:bg-pink-100 transition-colors">
            <span className="text-4xl mb-2">📸</span>
            <p className="text-sm font-semibold text-pink-500">Tap to upload photo</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG — max 10MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFilePick}
          />
        </label>
      )}

      {/* Checking state */}
      {status === 'checking' && (
        <div className="w-full h-48 rounded-2xl border border-pink-200 bg-pink-50
                        flex flex-col items-center justify-center gap-3">
          {previewUrl && (
            <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-30" alt="" />
          )}
          <Spinner size="lg" />
          <p className="text-sm font-medium text-pink-500">Analysing photo…</p>
          <p className="text-xs text-gray-400">Checking quality, lighting & content</p>
        </div>
      )}

      {/* Preview with status overlay */}
      {(status === 'warning' || status === 'done') && previewUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-pink-200">
          <img
            src={previewUrl}
            alt="Upload preview"
            className="w-full h-56 object-cover"
          />
          {/* Status badge */}
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold
            ${status === 'done' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
            {status === 'done' ? '✓ Looks good' : '⚠ Review needed'}
          </div>

          {/* Dominant color swatches */}
          {visionResult?.dominantColors?.length > 0 && (
            <div className="absolute bottom-3 left-3 flex gap-1">
              {visionResult.dominantColors.map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                     style={{ background: c }} title={c} />
              ))}
            </div>
          )}

          {/* File info */}
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px]
                          px-2 py-1 rounded-lg">
            {formatFileSize(file?.size || 0)}
          </div>
        </div>
      )}

      {/* ── Local quality issues (hard blocks) ── */}
      {localIssues.length > 0 && (
        <div className="space-y-2">
          {localIssues.map((issue, i) => (
            <IssueCard key={i} type="error" message={issue.message} />
          ))}
          <RetakeButton onClick={handleRetake} fileRef={fileRef} onChange={handleFilePick} />
        </div>
      )}

      {/* ── Vision API warnings (soft — can acknowledge) ── */}
      {status === 'warning' && localIssues.length === 0 && (
        <div className="space-y-2">

          {/* Shot type warnings */}
          {shotWarnings.map((w, i) => (
            <IssueCard key={`sw${i}`} type="warning" message={w} />
          ))}

          {/* Damage warnings */}
          {visionResult?.damageWarnings?.map((w, i) => (
            <IssueCard key={`dw${i}`} type="damage" message={w} />
          ))}

          {/* Acknowledge or retake */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleRetake}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold
                         py-2.5 rounded-2xl text-sm hover:border-gray-300 transition-colors"
            >
              Retake Photo
            </button>
            <button
              onClick={() => { setDamageAcked(true); setStatus('done') }}
              className="flex-1 bg-amber-400 text-white font-semibold
                         py-2.5 rounded-2xl text-sm hover:bg-amber-500 transition-colors"
            >
              I Understand, Continue
            </button>
          </div>

          {damageAcked && (
            <p className="text-xs text-gray-400 text-center">
              Please describe any flaws honestly in the listing description.
            </p>
          )}
        </div>
      )}

      {/* ── Auto-tag suggestions ── */}
      {autoTags.length > 0 && status === 'done' && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-purple-700 mb-2">
            ✨ AI detected these tags — added to your listing:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {autoTags.map(tag => (
              <span key={tag}
                    className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirm button (only when done) ── */}
      {status === 'done' && (
        <div className="flex gap-2">
          <button
            onClick={handleRetake}
            className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm
                       font-medium rounded-2xl hover:border-gray-300 transition-colors"
          >
            Retake
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-pink-500 text-white font-semibold py-2.5 rounded-2xl
                       text-sm hover:bg-pink-600 active:scale-95 transition-all"
          >
            Use This Photo →
          </button>
        </div>
      )}

      {/* Skip button (optional steps only) */}
      {!info.required && status === 'idle' && (
        <button
          onClick={onSkip}
          className="w-full text-gray-400 text-sm py-2 hover:text-gray-500 transition-colors"
        >
          Skip this step
        </button>
      )}

    </div>
  )
}

/* ── Small reusable sub-components ── */

function IssueCard({ type, message }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    damage:  'bg-orange-50 border-orange-200 text-orange-700',
  }
  const icons = { error: '🚫', warning: '⚠️', damage: '🔍' }

  return (
    <div className={`border rounded-xl px-3 py-2.5 flex gap-2 items-start ${styles[type]}`}>
      <span className="text-base flex-shrink-0">{icons[type]}</span>
      <p className="text-xs leading-relaxed">{message}</p>
    </div>
  )
}

function RetakeButton({ onClick, fileRef, onChange }) {
  return (
    <label className="block cursor-pointer">
      <div
        onClick={onClick}
        className="w-full text-center bg-pink-500 text-white font-semibold
                   py-3 rounded-2xl text-sm hover:bg-pink-600 transition-colors"
      >
        📸 Retake Photo
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onChange}
      />
    </label>
  )
}
