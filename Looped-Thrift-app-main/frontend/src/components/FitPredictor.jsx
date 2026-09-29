import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function FitPredictor({ productId, onOpenMeasurements }) {
  const { token } = useAuth();
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && productId) {
      fetchFitPrediction();
    } else {
      setLoading(false);
    }
  }, [productId, token]);

  const fetchFitPrediction = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/size/predict/${productId}`);
      setPrediction(res.data);
    } catch (err) {
      console.warn('Could not fetch fit prediction', err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div
        className="p-3.5 rounded-2xl border text-xs flex items-center justify-between my-3"
        style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}
      >
        <div className="flex items-center gap-2">
          <span>📐</span>
          <span style={{ color: 'var(--ink)' }}>Log in to see if this item fits your body measurements.</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-3 rounded-2xl border animate-pulse my-3" style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}>
        <p className="text-xs text-gray-400">Analysing sizing & ease measurements...</p>
      </div>
    );
  }

  if (!prediction || !prediction.hasProfile) {
    return (
      <div
        className="p-3.5 rounded-2xl border text-xs flex items-center justify-between my-3"
        style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}
      >
        <div className="flex items-center gap-2">
          <span>📐</span>
          <span style={{ color: 'var(--ink)' }}>Add your measurements to unlock AI fit predictions</span>
        </div>
        <button
          type="button"
          onClick={onOpenMeasurements}
          className="font-bold underline text-xs ml-2"
          style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}
        >
          Add Profile ✦
        </button>
      </div>
    );
  }

  if (!prediction.hasMeasurements) {
    return (
      <div
        className="p-3 rounded-2xl border text-xs text-gray-500 my-3 flex items-center gap-2"
        style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}
      >
        <span>📏</span>
        <span>Seller hasn't listed detailed garment measurements for this piece.</span>
      </div>
    );
  }

  const isFit = prediction.verdict === 'fits';
  const isLikely = prediction.verdict === 'likely_fits';
  const isLoose = prediction.verdict === 'too_large';
  const isTight = prediction.verdict === 'too_small';

  return (
    <div
      className="p-4 rounded-2xl border my-3 space-y-2 text-xs"
      style={{
        backgroundColor: isFit ? '#EEF4E9' : isTight ? '#FBE9EF' : isLoose ? '#FFF7F2' : 'var(--cream)',
        borderColor: isFit ? 'var(--green-sage)' : isTight ? 'var(--pink-hot)' : 'var(--pink-cotton)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isFit ? '🟢' : isTight ? '🔴' : '🟡'}</span>
          <p className="font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif", color: isFit ? 'var(--green-forest)' : isTight ? 'var(--pink-deep)' : 'var(--pink-mauve)' }}>
            Fit Prediction: {isFit ? 'Fits You Well ✓' : isTight ? 'May Run Small / Tight' : isLoose ? 'Loose / Relaxed Fit' : 'Likely Fits'}
          </p>
        </div>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
          style={{
            backgroundColor: prediction.confidence === 'high' ? 'var(--green-sage)' : 'var(--gold)',
            color: '#fff'
          }}
        >
          {prediction.confidence} Confidence
        </span>
      </div>

      <p className="text-[11px] text-gray-700 leading-snug">
        {prediction.message}
      </p>

      {/* Measurement breakdowns */}
      {prediction.checks && prediction.checks.length > 0 && (
        <div className="flex gap-2 flex-wrap pt-1">
          {prediction.checks.map((c, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
              style={{
                backgroundColor: c.result === 'fits' ? '#DCEEDC' : '#FBDCE8',
                borderColor: 'var(--pink-cotton)',
                color: c.result === 'fits' ? 'var(--green-forest)' : 'var(--pink-deep)',
                fontFamily: "'Fredoka', sans-serif"
              }}
            >
              {c.part}: {c.result === 'fits' ? '✓ fits' : c.result}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
