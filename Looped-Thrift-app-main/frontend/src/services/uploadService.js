// uploadService.js
// Uploads image files to backend which saves them to disk
// Returns permanent URLs like http://localhost:5000/uploads/filename.jpg

import api from './api'

/**
 * Upload a single image file
 * Returns the permanent URL
 */
export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.url
}

/**
 * Upload multiple images from the 4-step photo flow
 * completedPhotos: { 1: { file, previewUrl }, 2: {...}, ... }
 * Returns array of permanent URLs
 */
export async function uploadMultipleImages(completedPhotos) {
  const formData = new FormData()
  const steps    = Object.keys(completedPhotos)

  steps.forEach((step, index) => {
    if (completedPhotos[step]?.file) {
      formData.append(`image_${index}`, completedPhotos[step].file)
    }
  })

  const res    = await api.post('/upload/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const urlMap = res.data.urls
  const urls   = []

  for (let i = 0; i < steps.length; i++) {
    const key = `image_${i}`
    if (urlMap[key]) urls.push(urlMap[key].url)
  }
  return urls
}
