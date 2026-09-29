import React, { useState } from 'react';

const FASHION_SAVINGS_MAP = {
  "Women's Tops": 2.1 * 0.82,
  "Women's T-Shirts": 2.1 * 0.82,
  "Women's Crop Tops": 1.8 * 0.82,
  "Women's Dresses": 5.5 * 0.82,
  "Women's Outerwear": 12.0 * 0.82,
  "Women's Traditional": 4.2 * 0.82,
  "Women's Bottoms": 4.0 * 0.82,
  "Women's Sets": 6.0 * 0.82,
  "Men's Shirts": 2.8 * 0.82,
  "Men's Tops": 2.5 * 0.82,
  "Men's Bottoms": 4.0 * 0.82,
  "Men's Outerwear": 14.0 * 0.82,
  "Footwear": 7.5 * 0.82,
  "Bags": 8.2 * 0.82,
  "Accessories": 1.2 * 0.82,
  "default": 3.5 * 0.82
};

export default function CarbonSavingsBadge({ category = "Women's Tops", condition = 'Good' }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const co2Val = (FASHION_SAVINGS_MAP[category] || FASHION_SAVINGS_MAP.default).toFixed(1);
  const waterVal = Math.round(co2Val * 950);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip(prev => !prev);
      }}
    >
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-2xs select-none cursor-pointer"
        style={{ backgroundColor: 'var(--green-sage)', fontFamily: "'Fredoka', sans-serif" }}
      >
        <span>🌿</span>
        <span>Saves ~{co2Val}kg CO₂</span>
      </span>

      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-3 rounded-2xl shadow-xl z-30 text-left border text-xs"
          style={{
            backgroundColor: 'var(--ivory)',
            borderColor: 'var(--green-sage)',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div className="flex items-center gap-1.5 font-bold mb-1" style={{ color: 'var(--green-forest)', fontFamily: "'Fredoka', sans-serif" }}>
            <span>🌿</span>
            <span>Eco Impact Savings</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-snug">
            Thrifting this item prevents approximately <strong>{co2Val} kg of CO₂</strong> emissions and saves <strong>{waterVal} L</strong> of clean water vs new manufacturing!
          </p>
        </div>
      )}
    </div>
  );
}
