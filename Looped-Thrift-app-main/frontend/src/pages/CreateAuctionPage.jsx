import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAuction } from '../services/auctionService';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/helpers';
import Spinner from '../components/Spinner';
import api from '../services/api';

const CATEGORIES = [
  'Designer Wear',
  'Bridal & Couture',
  'Luxury Bags',
  'Designer Footwear',
  'Watches',
  'Fine Jewelry',
  'Designer Outerwear'
];

const CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved'];

const INCREMENT_OPTIONS = [
  { value: 250, label: '₹250 (Curated luxury pieces)' },
  { value: 500, label: '₹500 (High-value designer wear)' },
  { value: 1000, label: '₹1,000 (Fine jewelry & bridal couture)' },
  { value: 2500, label: '₹2,500 (Rare collector items & watches)' }
];

const GUIDED_IMAGE_SLOTS = [
  { key: 'front', label: 'Front View *', required: true, desc: 'Clear full front view' },
  { key: 'back', label: 'Back View *', required: true, desc: 'Full back view of the garment/item' },
  { key: 'tag', label: 'Brand Label / Tag *', required: true, desc: 'Close-up of brand tag/label' },
  { key: 'extra1', label: 'Detail Angle 1', required: false, desc: 'Fabric closeup / hardware' },
  { key: 'extra2', label: 'Detail Angle 2', required: false, desc: 'Stitching / serial code' },
  { key: 'extra3', label: 'Detail Angle 3', required: false, desc: 'Packaging / side view' }
];

export default function CreateAuctionPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Item details
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Designer Wear');
  const [condition, setCondition] = useState('Like New');
  const [size, setSize] = useState('');
  const [description, setDescription] = useState('');
  const [purchaseYear, setPurchaseYear] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');

  // Photos (slots)
  const [photos, setPhotos] = useState({}); // { front: { file, url, uploading } }
  const [photosError, setPhotosError] = useState('');

  // Authenticity & Proof
  const [proofs, setProofs] = useState({
    bill: null, // { file, url, name, type: 'bill', uploading }
    authDoc: null, // { file, url, name, type: 'certificate' | 'serial_tag' | 'dustbag_box', uploading }
    authType: 'certificate',
    extraProof: null // { file, url, name, type: 'other', uploading }
  });

  // Pricing & Schedule
  const [startingPrice, setStartingPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [incrementAmount, setIncrementAmount] = useState('250');

  const toLocalIso = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [startTime, setStartTime] = useState(toLocalIso(new Date()));
  const [endTime, setEndTime] = useState(toLocalIso(new Date(Date.now() + 48 * 60 * 60 * 1000)));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/auction/create' } });
    }
  }, [token]);

  // Upload photo slot
  const handlePhotoUpload = async (slotKey, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotosError('Only image files (JPG, PNG, WEBP) are supported for item photos.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPhotos(prev => ({
      ...prev,
      [slotKey]: { file, previewUrl, uploading: true }
    }));
    setPhotosError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setPhotos(prev => ({
        ...prev,
        [slotKey]: { file, previewUrl: res.data.url, url: res.data.url, uploading: false }
      }));
    } catch (err) {
      console.error('Photo upload failed:', err);
      setPhotosError(`Failed to upload photo for ${slotKey}. Please try again.`);
      setPhotos(prev => {
        const copy = { ...prev };
        delete copy[slotKey];
        return copy;
      });
    }
  };

  const removePhoto = (slotKey) => {
    setPhotos(prev => {
      const copy = { ...prev };
      delete copy[slotKey];
      return copy;
    });
  };

  // Upload proof document (PDF / Images up to 10MB)
  const handleProofUpload = async (proofKey, file, typeOverride) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    const isImg = file.type.startsWith('image/');
    if (!isPdf && !isImg) {
      setError('Proof files must be JPG, PNG, WEBP, or PDF.');
      return;
    }

    const docType = typeOverride || (proofKey === 'bill' ? 'bill' : proofs.authType);
    setProofs(prev => ({
      ...prev,
      [proofKey]: { file, name: file.name, isPdf, uploading: true }
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);

      const res = await api.post('/upload/proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setProofs(prev => ({
        ...prev,
        [proofKey]: {
          file,
          name: file.name,
          url: res.data.url,
          type: docType,
          isPdf,
          uploading: false
        }
      }));
    } catch (err) {
      console.error('Proof upload error:', err);
      setError(`Failed to upload proof document: ${err.response?.data?.message || err.message}`);
      setProofs(prev => ({
        ...prev,
        [proofKey]: null
      }));
    }
  };

  const uploadedImagesCount = Object.values(photos).filter(p => p && p.url).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Form validations
    if (!title.trim()) return setError('Please provide an item title.');
    if (!brand.trim()) return setError('Brand name is required for luxury auctions.');
    
    const valNum = Number(declaredValue);
    if (isNaN(valNum) || valNum < 5000) {
      return setError('Declared purchase/retail value must be at least ₹5,000. Auctions are reserved for designer and luxury pieces.');
    }

    const uploadedUrls = Object.values(photos)
      .filter(p => p && p.url)
      .map(p => p.url);

    if (uploadedUrls.length < 3) {
      return setError('Please upload at least 3 photos (Front, Back, Brand Tag required).');
    }

    if (!proofs.bill || !proofs.bill.url) {
      return setError('Purchase bill / invoice is mandatory for authenticity verification.');
    }

    if (!proofs.authDoc || !proofs.authDoc.url) {
      return setError('At least one authenticity proof (Certificate, Serial Tag, or Dust Bag/Box) is required.');
    }

    const startP = Number(startingPrice);
    if (!startP || startP <= 0) {
      return setError('Please enter a valid starting bid price.');
    }
    const resP = Number(reservePrice) || 0;
    if (resP > 0 && resP < startP) {
      return setError('Reserve price must be greater than or equal to starting price.');
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return setError('Auction end time must be after start time.');
    }

    setSubmitting(true);
    try {
      const proofDocsList = [
        { type: 'bill', url: proofs.bill.url, originalName: proofs.bill.name },
        { type: proofs.authDoc.type || proofs.authType, url: proofs.authDoc.url, originalName: proofs.authDoc.name }
      ];
      if (proofs.extraProof && proofs.extraProof.url) {
        proofDocsList.push({ type: 'other', url: proofs.extraProof.url, originalName: proofs.extraProof.name });
      }

      const payload = {
        title: title.trim(),
        brand: brand.trim(),
        category,
        condition,
        size: size.trim(),
        description: description.trim(),
        purchaseYear: purchaseYear.trim(),
        declaredValue: valNum,
        images: uploadedUrls,
        image: uploadedUrls[0],
        proofDocs: proofDocsList,
        startingPrice: startP,
        reservePrice: resP,
        incrementAmount: Number(incrementAmount) || 250,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString()
      };

      const created = await createAuction(payload);
      setSuccess('Luxury Drop submitted for verification! 🎉 Our team will review authenticity within 2-4 hours.');
      setTimeout(() => {
        navigate('/auction');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create auction. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3.5 flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.94)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <button
          onClick={() => navigate('/auction')}
          className="p-1 rounded-full hover:bg-pink-100 transition text-gray-600"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold leading-none" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
            Submit Luxury Drop 💎 ✦
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
            Curated Designer Auctions · Verified Authenticity
          </p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Luxury Rule Banner */}
        <div
          className="rounded-2xl p-4 border flex items-start gap-3 text-xs"
          style={{
            backgroundColor: 'var(--pink-blush)',
            borderColor: 'var(--pink-cotton)'
          }}
        >
          <span className="text-2xl flex-shrink-0">💎</span>
          <div>
            <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--pink-mauve)', fontFamily: "'Playfair Display', serif" }}>
              Luxury & Designer Drops Only
            </p>
            <p className="text-gray-600 text-[11px] leading-relaxed">
              Live auctions are exclusively for high-end designer and couture fashion with declared value of <strong>₹5,000+</strong>. All submissions require proof of purchase and authenticity verification before going live.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3.5 rounded-2xl font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3.5 rounded-2xl font-semibold text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Item Details */}
          <div
            className="card p-5 border space-y-3.5"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)', borderRadius: '24px' }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
              <span>1. Designer Item Details ✦</span>
              <span className="text-[10px] font-normal text-rose-500">Min. ₹5,000 Value</span>
            </h2>

            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                Item Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Sabyasachi Raw Silk Bridal Dupatta / Chanel Classic Flap"
                className="input text-xs font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Brand / Designer *
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. Gucci, Anita Dongre, Tarun Tahiliani"
                  className="input text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Category *
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="input text-xs"
                  required
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Condition *
                </label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  className="input text-xs"
                >
                  {CONDITIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Size
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  placeholder="e.g. S, M, Free"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Year / Date
                </label>
                <input
                  type="text"
                  value={purchaseYear}
                  onChange={e => setPurchaseYear(e.target.value)}
                  placeholder="e.g. 2023"
                  className="input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                Declared Purchase / Retail Value (₹) *
              </label>
              <input
                type="number"
                min="5000"
                step="500"
                value={declaredValue}
                onChange={e => setDeclaredValue(e.target.value)}
                placeholder="Must be ₹5,000 or higher"
                className="input text-sm font-bold"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Auctions are reserved for high-value items (≥ ₹5,000). For everyday fashion, list in the general thrift marketplace.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                Description & Provenance
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe authenticity hallmarks, fabric blend, embroidery, condition flaws, and historical provenance..."
                rows={3}
                className="input text-xs"
              />
            </div>
          </div>

          {/* Section 2: Guided Real Photo Uploads */}
          <div
            className="card p-5 border space-y-3.5"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)', borderRadius: '24px' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
                2. Item Photos ({uploadedImagesCount}/8) ✦
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${uploadedImagesCount >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                {uploadedImagesCount >= 3 ? '✓ Min 3 photos met' : 'Min 3 photos required'}
              </span>
            </div>

            {photosError && (
              <p className="text-xs text-rose-600 font-medium">{photosError}</p>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {GUIDED_IMAGE_SLOTS.map(slot => {
                const photo = photos[slot.key];
                return (
                  <div
                    key={slot.key}
                    className="relative border rounded-2xl p-2 flex flex-col items-center justify-center text-center overflow-hidden min-h-[110px]"
                    style={{
                      backgroundColor: photo?.previewUrl ? 'transparent' : 'var(--cream)',
                      borderColor: slot.required && !photo?.url ? 'var(--pink-rose)' : 'var(--pink-cotton)'
                    }}
                  >
                    {photo?.previewUrl ? (
                      <div className="relative w-full h-full flex flex-col items-center">
                        <img src={photo.previewUrl} alt={slot.label} className="w-full h-20 object-cover rounded-xl" />
                        {photo.uploading && (
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center text-white">
                            <Spinner size="sm" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(slot.key)}
                          className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
                        >
                          ✕
                        </button>
                        <span className="text-[9px] font-semibold text-gray-600 mt-1 truncate max-w-full">
                          {slot.label.replace('*', '')}
                        </span>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-1 hover:bg-pink-100/50 transition rounded-xl">
                        <span className="text-xl">📸</span>
                        <span className="text-[10px] font-bold text-gray-700 mt-0.5 leading-tight">{slot.label}</span>
                        <span className="text-[8px] text-gray-400 mt-0.5">{slot.desc}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files?.[0]) handlePhotoUpload(slot.key, e.target.files[0]);
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Authenticity & Proof Documents */}
          <div
            className="card p-5 border space-y-4"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)', borderRadius: '24px' }}
          >
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
                <span>🔒 3. Authenticity & Proof Documents ✦</span>
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Encrypted & confidential. Only Looped verification admins and you can access these documents.
              </p>
            </div>

            {/* Proof 1: Purchase Bill / Invoice (Required) */}
            <div className="p-3.5 rounded-2xl border bg-white/70" style={{ borderColor: 'var(--pink-cotton)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-800">
                  📄 1. Purchase Bill / Invoice *
                </span>
                {proofs.bill?.url && <span className="text-[10px] text-emerald-600 font-bold">✓ Uploaded</span>}
              </div>
              <p className="text-[10px] text-gray-500 mb-2">
                Store invoice, order confirmation, or credit receipt (PDF, JPG, PNG up to 10MB)
              </p>
              {proofs.bill?.url ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-xs text-emerald-800">
                  <span className="truncate max-w-[200px]">{proofs.bill.name || 'Invoice document'}</span>
                  <button
                    type="button"
                    onClick={() => setProofs(p => ({ ...p, bill: null }))}
                    className="text-rose-500 hover:underline text-[11px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-pink-300 py-2.5 rounded-xl cursor-pointer hover:bg-pink-50 transition text-xs font-semibold text-pink-600">
                  {proofs.bill?.uploading ? <Spinner size="sm" /> : '📎 Upload Bill / Invoice'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files?.[0]) handleProofUpload('bill', e.target.files[0], 'bill');
                    }}
                  />
                </label>
              )}
            </div>

            {/* Proof 2: Certificate or Serial Tag or Dust Bag (Required at least one) */}
            <div className="p-3.5 rounded-2xl border bg-white/70" style={{ borderColor: 'var(--pink-cotton)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-800">
                  🏷️ 2. Authenticity Certificate / Serial Tag / Box *
                </span>
                {proofs.authDoc?.url && <span className="text-[10px] text-emerald-600 font-bold">✓ Uploaded</span>}
              </div>
              <div className="flex gap-2 mb-2">
                {[
                  { id: 'certificate', label: 'Certificate' },
                  { id: 'serial_tag', label: 'Serial Tag' },
                  { id: 'dustbag_box', label: 'Dustbag / Box' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProofs(p => ({ ...p, authType: t.id }))}
                    className={`text-[10px] font-bold py-1 px-2.5 rounded-lg border transition ${
                      proofs.authType === t.id ? 'bg-pink-500 text-white border-pink-500' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {proofs.authDoc?.url ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-xs text-emerald-800">
                  <span className="truncate max-w-[200px]">{proofs.authDoc.name || 'Authenticity proof'}</span>
                  <button
                    type="button"
                    onClick={() => setProofs(p => ({ ...p, authDoc: null }))}
                    className="text-rose-500 hover:underline text-[11px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-pink-300 py-2.5 rounded-xl cursor-pointer hover:bg-pink-50 transition text-xs font-semibold text-pink-600">
                  {proofs.authDoc?.uploading ? <Spinner size="sm" /> : `📎 Upload ${proofs.authType.replace('_', ' ')} Proof`}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files?.[0]) handleProofUpload('authDoc', e.target.files[0], proofs.authType);
                    }}
                  />
                </label>
              )}
            </div>

            {/* Proof 3: Extra proof (Optional) */}
            <div className="p-3 rounded-2xl border bg-white/50" style={{ borderColor: 'var(--pink-cotton)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  ✨ 3. Additional Proof (Optional)
                </span>
                {proofs.extraProof?.url && <span className="text-[10px] text-emerald-600 font-bold">✓ Uploaded</span>}
              </div>
              {proofs.extraProof?.url ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-xs text-emerald-800 mt-2">
                  <span className="truncate max-w-[200px]">{proofs.extraProof.name}</span>
                  <button
                    type="button"
                    onClick={() => setProofs(p => ({ ...p, extraProof: null }))}
                    className="text-rose-500 hover:underline text-[11px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 py-2 rounded-xl cursor-pointer hover:bg-pink-50/50 transition text-[11px] text-gray-500 mt-2">
                  {proofs.extraProof?.uploading ? <Spinner size="sm" /> : '+ Add extra appraisals or receipts'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files?.[0]) handleProofUpload('extraProof', e.target.files[0], 'other');
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Section 4: Luxury Pricing & Schedule */}
          <div
            className="card p-5 border space-y-3.5"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)', borderRadius: '24px' }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
              4. Auction Bidding & Schedule ✦
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Starting Price (₹) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="250"
                  value={startingPrice}
                  onChange={e => setStartingPrice(e.target.value)}
                  placeholder="e.g. 2500"
                  className="input text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Reserve Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={reservePrice}
                  onChange={e => setReservePrice(e.target.value)}
                  placeholder="e.g. 5000 (Optional)"
                  className="input text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                Minimum Bid Increment (₹)
              </label>
              <select
                value={incrementAmount}
                onChange={e => setIncrementAmount(e.target.value)}
                className="input text-xs font-semibold"
              >
                {INCREMENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="input text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)' }}>
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="input text-xs font-medium"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || uploadedImagesCount < 3}
            className="btn-primary w-full py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {submitting ? <Spinner size="sm" /> : 'Submit for Authenticity Review 💎 ✦'}
          </button>
        </form>
      </div>
    </div>
  );
}
