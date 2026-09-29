// ─────────────────────────────────────────────────────────────
//  visionService.js  —  Looped Vision & Quality Checker Service
//  Securely routes through backend /products/search-visual endpoint.
//  No client-side OpenAI API keys needed.
// ─────────────────────────────────────────────────────────────

import api from './api';

/**
 * Master CV analysis for uploaded clothing photos.
 * Routes through the backend /products/search-visual endpoint.
 *
 * Returns:
 * {
 *   isClothing:     boolean,
 *   hasPerson:      boolean,
 *   damageWarnings: string[],
 *   autoTags:       string[],
 *   shotType:       string,
 *   dominantColors: string[],
 *   rawResponse:    string
 * }
 */
export async function analyseWithVision(file) {
  try {
    // Convert file to base64 data URL
    const base64 = await fileToBase64DataUrl(file);

    const res = await api.post('/products/search-visual', {
      imageUrl: base64,
      mode: 'analyse'
    });

    const data = res.data;

    return {
      isClothing:     data.isClothing     ?? true,
      hasPerson:      data.hasPerson      ?? false,
      damageWarnings: data.damageWarnings ?? [],
      autoTags:       data.autoTags       ?? [],
      shotType:       data.shotType       ?? 'unknown',
      dominantColors: data.dominantColors ?? [],
      qualityIssues:  data.qualityIssues  ?? [],
      isGoodPhoto:    data.isGoodPhoto    ?? true,
      rawResponse:    data.rawResponse    || '',
    };
  } catch (err) {
    console.warn('Backend visual analysis fallback:', err.message);
    return getDefaultResult();
  }
}

/**
 * Validate shot type against what was expected for this step.
 * step: 1=front, 2=back, 3=closeup, 4=on-model
 */
export function validateShotType(visionResult, step) {
  const warnings = [];
  const { shotType, isClothing, isGoodPhoto, qualityIssues } = visionResult;

  // Quality issues from GPT
  if (qualityIssues?.length > 0) {
    qualityIssues.forEach(issue => warnings.push(issue));
  }

  if (!isClothing) {
    warnings.push("We couldn't detect a clothing item in this photo. Please make sure the garment is clearly visible.");
  }

  if (step === 3 && shotType !== 'closeup' && shotType !== 'unknown') {
    warnings.push('Step 3 should be a close-up of the fabric texture — zoom in on the material.');
  }

  if (step === 4 && !visionResult.hasPerson) {
    warnings.push('No person detected. The on-model shot should show someone wearing the item.');
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

/** Convert File to base64 data URL (includes mime type prefix) */
function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);  // keeps data:image/jpeg;base64, prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  };
}
