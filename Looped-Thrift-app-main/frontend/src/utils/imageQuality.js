// ─────────────────────────────────────────────────────────────
//  imageQuality.js  —  browser-side CV checks using Canvas API
//  No external API calls. Runs instantly in the browser.
// ─────────────────────────────────────────────────────────────

/**
 * Master function — run all local checks on a File object.
 * Returns { passed, issues[], meta{} }
 *
 * Thresholds tuned for real phone photos of clothing:
 * - Blur threshold lowered (phone cameras produce softer images)
 * - Brightness range widened (indoor lighting varies a lot)
 * - Added confidence levels so minor issues are warnings not blocks
 */
export async function runLocalChecks(file) {
  const issues = []

  const { ctx, width, height } = await fileToCanvas(file)

  // ── 1. File size ─────────────────────────────────────────
  // Under 20KB is almost certainly a thumbnail or screenshot
  if (file.size < 20 * 1024) {
    issues.push({
      type: 'size',
      severity: 'block',   // hard block — must retake
      message: 'Image is too small (under 20KB). Please use a real photo, not a screenshot or thumbnail.',
    })
  }

  // ── 2. Aspect ratio ──────────────────────────────────────
  // Allow portrait (tall), square, and mild landscape
  // Block only extreme panoramas or very tall thin crops
  const ratio = width / height
  if (ratio > 2.5 || ratio < 0.3) {
    issues.push({
      type: 'ratio',
      severity: 'block',
      message: 'Please use a portrait or square photo. Extreme wide or tall crops don\'t look good on listings.',
    })
  }

  // ── 3. Brightness ────────────────────────────────────────
  // Widened range: 30–240 (was 40–230)
  // Most indoor phone photos land between 80–180
  const brightness = getAverageBrightness(ctx, width, height)

  if (brightness < 30) {
    issues.push({
      type: 'dark',
      severity: 'block',
      message: 'Photo is too dark. Try taking it near a window or turn on a light.',
    })
  } else if (brightness < 55) {
    // Soft warning — can still continue
    issues.push({
      type: 'dark-warn',
      severity: 'warn',
      message: 'Photo looks a little dark. Buyers prefer well-lit photos — try near a window if possible.',
    })
  }

  if (brightness > 240) {
    issues.push({
      type: 'bright',
      severity: 'block',
      message: 'Photo is overexposed. Move away from direct sunlight or bright lamps.',
    })
  }

  // ── 4. Blur / sharpness ──────────────────────────────────
  // Threshold dropped from 80 → 18
  // Reasoning:
  //   - Phone cameras with portrait/HDR mode produce naturally softer images
  //   - Clothing texture doesn't need to be razor sharp to be usable
  //   - Real blur (hands shaking, out of focus) scores < 8
  //   - Acceptable phone photo scores 18–200+
  //   - Professional DSLR scores 200–2000+
  const sharpness = getLaplacianVariance(ctx, width, height)

  if (sharpness < 8) {
    issues.push({
      type: 'blur',
      severity: 'block',
      message: 'Image is too blurry. Tap on the item to focus, hold your phone steady, and retake.',
    })
  } else if (sharpness < 18) {
    issues.push({
      type: 'blur-warn',
      severity: 'warn',
      message: 'Image looks slightly soft. If possible, tap to focus and retake for a crisper photo.',
    })
  }

  // ── 5. Blank / solid colour image ───────────────────────
  const variety = getColorVariety(ctx, width, height)
  if (variety < 8) {
    issues.push({
      type: 'blank',
      severity: 'block',
      message: 'This photo looks blank or nearly empty. Please upload a photo of the actual item.',
    })
  }

  // Separate hard blocks from soft warnings
  const blocks   = issues.filter(i => i.severity === 'block')
  const warnings = issues.filter(i => i.severity === 'warn')

  return {
    passed:   blocks.length === 0,   // only hard blocks cause a retake requirement
    blocks,
    warnings,
    issues,   // all issues combined (for legacy use)
    meta: {
      brightness: Math.round(brightness),
      sharpness:  Math.round(sharpness),
      width,
      height,
      fileSizeKB: Math.round(file.size / 1024),
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // Downsample to max 400px wide — enough for analysis, much faster
      const scale  = Math.min(1, 400 / img.width)
      const width  = Math.round(img.width  * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve({ canvas, ctx, width, height })
    }
    img.onerror = reject
    img.src = url
  })
}

function getAverageBrightness(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  let total = 0
  const pixels = w * h
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return total / pixels
}

function getLaplacianVariance(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  const gray = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0]
  const values = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0, k = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += gray[(y + ky) * w + (x + kx)] * kernel[k++]
        }
      }
      values.push(sum)
    }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
}

function getColorVariety(ctx, w, h) {
  const data    = ctx.getImageData(0, 0, w, h).data
  const buckets = new Set()
  for (let i = 0; i < data.length; i += 40) {
    const r = Math.floor(data[i]     / 32)
    const g = Math.floor(data[i + 1] / 32)
    const b = Math.floor(data[i + 2] / 32)
    buckets.add(`${r},${g},${b}`)
  }
  return buckets.size
}

export function createPreviewUrl(file) {
  return URL.createObjectURL(file)
}

export function formatFileSize(bytes) {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
