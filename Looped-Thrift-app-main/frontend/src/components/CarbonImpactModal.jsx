import React, { useState } from 'react';

export default function CarbonImpactModal({
  isOpen,
  onClose,
  co2Saved = 3.5,
  waterSaved = 2500,
  itemTitle = 'this piece'
}) {
  if (!isOpen) return null;

  const kmEquivalent = (co2Saved / 0.21).toFixed(1);
  const phoneCharges = Math.round(waterSaved / 0.02);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border relative overflow-hidden"
        style={{
          backgroundColor: 'var(--ivory)',
          borderColor: 'var(--green-sage)',
          boxShadow: 'var(--shadow)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800"
          style={{ backgroundColor: 'var(--pink-blush)' }}
        >
          ✕
        </button>

        {/* Celebration Header */}
        <div className="text-4xl mb-2 animate-bounce">🌿</div>
        <p className="text-xs uppercase font-bold tracking-widest" style={{ color: 'var(--green-forest)', fontFamily: "'Fredoka', sans-serif" }}>
          ✦ Circular Planet Impact ✦
        </p>
        <h2 className="text-2xl font-bold my-1" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
          You're Saving The Planet!
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          By purchasing {itemTitle} pre-loved, you prevented:
        </p>

        {/* Counter cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="p-3.5 rounded-2xl border text-center shadow-xs"
            style={{ backgroundColor: '#EEF4E9', borderColor: 'var(--green-sage)' }}
          >
            <p className="text-2xl font-black" style={{ color: 'var(--green-forest)', fontFamily: "'Fredoka', sans-serif" }}>
              {co2Saved} kg
            </p>
            <p className="text-[11px] font-bold text-gray-600">CO₂ Emissions</p>
          </div>
          <div
            className="p-3.5 rounded-2xl border text-center shadow-xs"
            style={{ backgroundColor: '#EAF4FF', borderColor: 'var(--blue-sky)' }}
          >
            <p className="text-2xl font-black text-blue-900" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              {waterSaved} L
            </p>
            <p className="text-[11px] font-bold text-gray-600">Clean Water</p>
          </div>
        </div>

        {/* Fun comparisons */}
        <div
          className="p-3 rounded-2xl border text-xs text-left space-y-1.5 mb-5"
          style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}
        >
          <div className="flex items-center gap-2">
            <span>🚗</span>
            <span style={{ color: 'var(--ink)' }}>Equivalent to <strong>{kmEquivalent} km</strong> not driven in a car</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📱</span>
            <span style={{ color: 'var(--ink)' }}>Equivalent to <strong>{phoneCharges.toLocaleString()}</strong> full phone charges of water</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-md"
          style={{ backgroundColor: 'var(--green-sage)', borderColor: 'transparent' }}
        >
          Keep Shopping Sustainably 🌿
        </button>
      </div>
    </div>
  );
}
