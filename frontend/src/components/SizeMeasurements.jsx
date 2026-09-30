import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Spinner from './Spinner';

export default function SizeMeasurements({ onSaved }) {
  const { user, token } = useAuth();
  const [gender, setGender] = useState('unisex');
  const [preferredFit, setPreferredFit] = useState('regular');
  const [measurements, setMeasurements] = useState({
    chest: '',
    waist: '',
    hips: '',
    height: '',
    weight: '',
    shoulder: '',
    inseam: '',
    footLength: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setFetching(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/size/profile');
      if (res.data) {
        setGender(res.data.gender || 'unisex');
        setPreferredFit(res.data.preferredFit || 'regular');
        setMeasurements({
          chest: res.data.measurements?.chest || '',
          waist: res.data.measurements?.waist || '',
          hips: res.data.measurements?.hips || '',
          height: res.data.measurements?.height || '',
          weight: res.data.measurements?.weight || '',
          shoulder: res.data.measurements?.shoulder || '',
          inseam: res.data.measurements?.inseam || '',
          footLength: res.data.measurements?.footLength || ''
        });
      }
    } catch (err) {
      console.warn('Could not fetch existing size profile', err);
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (field, val) => {
    setMeasurements(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSavedSuccess(false);

    try {
      const payload = {
        gender,
        preferredFit,
        measurements: {
          chest: measurements.chest ? Number(measurements.chest) : undefined,
          waist: measurements.waist ? Number(measurements.waist) : undefined,
          hips: measurements.hips ? Number(measurements.hips) : undefined,
          height: measurements.height ? Number(measurements.height) : undefined,
          weight: measurements.weight ? Number(measurements.weight) : undefined,
          shoulder: measurements.shoulder ? Number(measurements.shoulder) : undefined,
          inseam: measurements.inseam ? Number(measurements.inseam) : undefined,
          footLength: measurements.footLength ? Number(measurements.footLength) : undefined
        }
      };

      await api.post('/size/profile', payload);
      setSavedSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save size profile.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="py-12 flex justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div
      className="card p-5 border space-y-5"
      style={{
        backgroundColor: 'var(--ivory)',
        borderColor: 'var(--pink-cotton)',
        borderRadius: '24px'
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">📐</span>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
            Size Intelligence Profile ✦
          </h2>
          <p className="text-xs text-gray-500">
            Enter your measurements once for smart AI fit predictions on every thrift piece.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-2xl border text-xs font-bold text-center" style={{ backgroundColor: '#DCEEDC', borderColor: 'var(--green-sage)', color: 'var(--green-forest)' }}>
          ✓ Your size profile has been updated!
        </div>
      )}

      {error && (
        <div className="p-3 rounded-2xl border text-xs bg-rose-50 border-rose-200 text-rose-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Step 1: Gender */}
        <div>
          <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
            Step 1: Department / Sizing Model
          </label>
          <div className="flex gap-2">
            {[
              { id: 'women', label: 'Women' },
              { id: 'men', label: 'Men' },
              { id: 'unisex', label: 'Unisex' }
            ].map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGender(g.id)}
                className={`flex-1 py-2 rounded-2xl text-xs font-semibold border transition ${
                  gender === g.id ? 'text-white shadow-xs' : ''
                }`}
                style={{
                  backgroundColor: gender === g.id ? 'var(--pink-hot)' : 'var(--cream)',
                  borderColor: 'var(--pink-cotton)',
                  color: gender === g.id ? '#fff' : 'var(--pink-mauve)',
                  fontFamily: "'Fredoka', sans-serif"
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Preferred Fit */}
        <div>
          <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
            Step 2: Preferred Fit Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'slim', label: 'Slim Fit', desc: 'Form fitting (+2cm ease)' },
              { id: 'regular', label: 'Regular Fit', desc: 'Standard comfort (+5cm ease)' },
              { id: 'relaxed', label: 'Relaxed Fit', desc: 'Slightly loose (+8cm ease)' },
              { id: 'oversized', label: 'Oversized', desc: 'Baggy aesthetic (+12cm ease)' }
            ].map(f => (
              <div
                key={f.id}
                onClick={() => setPreferredFit(f.id)}
                className={`p-3 rounded-2xl border cursor-pointer transition text-left ${
                  preferredFit === f.id ? 'shadow-xs' : ''
                }`}
                style={{
                  backgroundColor: preferredFit === f.id ? 'var(--pink-blush)' : 'var(--cream)',
                  borderColor: preferredFit === f.id ? 'var(--pink-hot)' : 'var(--pink-cotton)'
                }}
              >
                <p className="text-xs font-bold" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>{f.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Measurement Visual Diagram Outline (SVG) */}
        <div
          className="p-3 rounded-2xl border flex items-center gap-3 text-xs"
          style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}
        >
          <svg viewBox="0 0 80 110" className="w-16 h-20 flex-shrink-0">
            {/* Silhouette */}
            <circle cx="40" cy="16" r="10" fill="#FBDCE8" stroke="#8F3F63" strokeWidth="1.5" />
            <path d="M24 36 C24 30, 56 30, 56 36 L62 62 L52 64 L48 44 L48 85 L44 105 L36 105 L32 85 L32 44 L28 64 L18 62 Z" fill="#FBDCE8" stroke="#8F3F63" strokeWidth="1.5" />
            {/* Measure lines */}
            <line x1="28" y1="42" x2="52" y2="42" stroke="#EC6FA7" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="32" y1="56" x2="48" y2="56" stroke="#EC6FA7" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="30" y1="68" x2="50" y2="68" stroke="#EC6FA7" strokeWidth="2" strokeDasharray="2 2" />
          </svg>
          <div>
            <p className="font-bold text-xs" style={{ color: 'var(--pink-mauve)' }}>How to Measure</p>
            <p className="text-[11px] text-gray-600 leading-snug mt-0.5">
              Use a flexible tape measure around the fullest parts of your chest and hips, and the narrowest part of your natural waist.
            </p>
          </div>
        </div>

        {/* Step 3: Measurement Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold block mb-1 text-gray-700">Chest / Bust (cm)</label>
            <input
              type="number"
              placeholder="e.g. 92"
              value={measurements.chest}
              onChange={e => handleInputChange('chest', e.target.value)}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1 text-gray-700">Waist (cm)</label>
            <input
              type="number"
              placeholder="e.g. 76"
              value={measurements.waist}
              onChange={e => handleInputChange('waist', e.target.value)}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1 text-gray-700">Hips (cm)</label>
            <input
              type="number"
              placeholder="e.g. 98"
              value={measurements.hips}
              onChange={e => handleInputChange('hips', e.target.value)}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1 text-gray-700">Shoulder Width (cm)</label>
            <input
              type="number"
              placeholder="e.g. 42"
              value={measurements.shoulder}
              onChange={e => handleInputChange('shoulder', e.target.value)}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1 text-gray-700">Inseam (Trousers, cm)</label>
            <input
              type="number"
              placeholder="e.g. 78"
              value={measurements.inseam}
              onChange={e => handleInputChange('inseam', e.target.value)}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1 text-gray-700">Height (cm)</label>
            <input
              type="number"
              placeholder="e.g. 168"
              value={measurements.height}
              onChange={e => handleInputChange('height', e.target.value)}
              className="input text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-md mt-2"
        >
          {loading ? <Spinner size="sm" /> : 'Save Measurements ✦'}
        </button>
      </form>
    </div>
  );
}
