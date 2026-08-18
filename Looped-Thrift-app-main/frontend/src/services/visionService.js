// ─────────────────────────────────────────────────────────────
//  visionService.js  —  OpenAI GPT-4o Vision API
//
//  Setup (one-time):
//  1. Go to platform.openai.com
//  2. API Keys → Create new secret key → copy it
//  3. Open frontend/.env and set:
//     VITE_OPENAI_API_KEY=sk-proj-your-key-here
//
//  Cost: ~$0.002 per image analysis (very cheap)
//  $1.20 = ~400-600 analyses — plenty for dev + demo
// ─────────────────────────────────────────────────────────────

const API_KEY  = import.meta.env.VITE_OPENAI_API_KEY
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

/**
 * Master CV analysis using GPT-4o vision.
 * Pass a File object → returns structured analysis result.
 *
 * Returns:
 * {
 *   isClothing:     boolean,
 *   hasPerson:      boolean,
 *   damageWarnings: string[],
 *   autoTags:       string[],
 *   shotType:       string,
 *   dominantColors: string[],
 *   rawResponse:    string   (GPT's full reply, for debugging)
 * }
 */
export async function analyseWithVision(file) {
  if (!API_KEY || API_KEY === 'your-openai-key-here') {
    console.warn('No OpenAI API key set — skipping cloud CV checks')
    return getDefaultResult()
  }

  // Convert file to base64 data URL
  const base64 = await fileToBase64DataUrl(file)

  // ── Prompt — asks GPT-4o exactly what we need ────────────
  // We ask for JSON output so we can parse it reliably
  const prompt = `You are a quality checker for a fashion thrift marketplace app called Looped.
Analyse this clothing photo and respond with ONLY a valid JSON object — no extra text, no markdown.

Return exactly this structure:
{
  "isClothing": true or false,
  "hasPerson": true or false,
  "damageWarnings": ["array of warning strings if stains/damage/tears visible, empty array if none"],
  "autoTags": ["array of relevant fashion tags from this list only: denim, floral, black, white, patterned, striped, plaid, leather, silk, cotton, wool, lace, embroidered, vintage, casual, formal, dress, jacket, coat, tops, bottoms, skirt, footwear, bags, jewelry, pink, red, blue, green, yellow, orange, purple, brown, grey, minimalist, streetwear, traditional, oversized, fitted, sheer, velvet, knit, printed, solid, dark, light, pastel, bold"],
  "shotType": "full-front or full-back or closeup or on-model or unknown",
  "dominantColors": ["top 3 color names visible in the image"],
  "qualityIssues": ["any quality issues like blur, bad lighting, messy background — empty array if fine"],
  "isGoodPhoto": true or false
}

Be strict about damage detection — buyers rely on honest listings.
Be generous with tags — more tags help buyers discover items.`

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'text',       text: prompt },
            { type: 'image_url',  image_url: { url: base64, detail: 'low' } },
            // detail: 'low' uses fewer tokens = cheaper (~$0.002/image)
          ]
        }]
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('OpenAI Vision error:', res.status, err?.error?.message)
      return getDefaultResult()
    }

    const data     = await res.json()
    const rawText  = data.choices?.[0]?.message?.content || ''

    // Parse the JSON response from GPT
    let parsed
    try {
      // Strip any accidental markdown fences GPT sometimes adds
      const clean = rawText.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      console.warn('Could not parse GPT response as JSON:', rawText)
      return getDefaultResult()
    }

    return {
      isClothing:     parsed.isClothing     ?? true,
      hasPerson:      parsed.hasPerson      ?? false,
      damageWarnings: parsed.damageWarnings ?? [],
      autoTags:       parsed.autoTags       ?? [],
      shotType:       parsed.shotType       ?? 'unknown',
      dominantColors: parsed.dominantColors ?? [],
      qualityIssues:  parsed.qualityIssues  ?? [],
      isGoodPhoto:    parsed.isGoodPhoto    ?? true,
      rawResponse:    rawText,
    }

  } catch (err) {
    console.warn('OpenAI Vision API unavailable:', err.message)
    return getDefaultResult()
  }
}

/**
 * Validate shot type against what was expected for this step.
 * step: 1=front, 2=back, 3=closeup, 4=on-model
 */
export function validateShotType(visionResult, step) {
  const warnings = []
  const { shotType, isClothing, isGoodPhoto, qualityIssues } = visionResult

  // Quality issues from GPT
  if (qualityIssues?.length > 0) {
    qualityIssues.forEach(issue => warnings.push(issue))
  }

  if (!isClothing) {
    warnings.push("We couldn't detect a clothing item in this photo. Please make sure the garment is clearly visible.")
  }

  if (step === 3 && shotType !== 'closeup' && shotType !== 'unknown') {
    warnings.push('Step 3 should be a close-up of the fabric texture — zoom in on the material.')
  }

  if (step === 4 && !visionResult.hasPerson) {
    warnings.push('No person detected. The on-model shot should show someone wearing the item.')
  }

  return warnings
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

/** Convert File to base64 data URL (includes mime type prefix) */
function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)  // keeps data:image/jpeg;base64, prefix
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getDefaultResult() {
  return {
    isClothing:     true,
    hasPerson:      false,
    damageWarnings: [],
    autoTags:       [],
    shotType:       'unknown',
    dominantColors: [],
    qualityIssues:  [],
    isGoodPhoto:    true,
    rawResponse:    '',
  }
}
