import React, { useState } from 'react';

export default function SustainabilityReport({ user }) {
  const [copied, setCopied] = useState(false);

  const stats = user?.sustainabilityStats || {
    totalCo2SavedKg: 12.4,
    totalWaterSavedLitres: 14500,
    totalItemsCirculated: 4,
    sustainabilityScore: 45,
    tier: 'Sprout'
  };

  const co2 = stats.totalCo2SavedKg || 0;
  const water = stats.totalWaterSavedLitres || 0;
  const items = stats.totalItemsCirculated || 0;
  const score = stats.sustainabilityScore || 0;
  const tier = stats.tier || 'Seedling';

  const treeDays = (co2 / 0.022).toFixed(0);
  const bathtubs = Math.round(water / 150);

  const shareText = `I've saved ${co2} kg of CO₂ and ${water.toLocaleString()} L of water by shopping thrift on Looped 🌿 #LoopedFashion #ThriftForThePlanet`;

  const handleShare = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Tier Badge Header */}
      <div
        className="rounded-3xl p-6 text-center border relative overflow-hidden shadow-md"
        style={{
          background: 'linear-gradient(135deg, var(--green-sage), var(--green-forest))',
          color: '#fff'
        }}
      >
        <span className="text-5xl mb-2 block">
          {tier === 'Forest Guardian' ? '🌲' : tier === 'Tree' ? '🌳' : tier === 'Leaf' ? '🍃' : tier === 'Sprout' ? '🌿' : '🌱'}
        </span>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          {tier} ✦ Level
        </h2>
        <p className="text-xs text-white/90 mt-1 mb-4" style={{ fontFamily: "'Fredoka', sans-serif" }}>
          Eco Score: {score}/100 • Circular Fashion Pioneer
        </p>

        {/* Progress Bar to next tier */}
        <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden max-w-xs mx-auto mb-1">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div
          className="p-3.5 rounded-2xl border text-center shadow-2xs"
          style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
        >
          <span className="text-2xl">🌍</span>
          <p className="text-lg font-black mt-1" style={{ color: 'var(--green-forest)', fontFamily: "'Fredoka', sans-serif" }}>
            {co2} kg
          </p>
          <p className="text-[10px] text-gray-500 font-bold">CO₂ Saved</p>
        </div>

        <div
          className="p-3.5 rounded-2xl border text-center shadow-2xs"
          style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
        >
          <span className="text-2xl">💧</span>
          <p className="text-lg font-black mt-1 text-blue-900" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            {water.toLocaleString()} L
          </p>
          <p className="text-[10px] text-gray-500 font-bold">Water Saved</p>
        </div>

        <div
          className="p-3.5 rounded-2xl border text-center shadow-2xs"
          style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
        >
          <span className="text-2xl">👗</span>
          <p className="text-lg font-black mt-1" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>
            {items}
          </p>
          <p className="text-[10px] text-gray-500 font-bold">Items Circulated</p>
        </div>
      </div>

      {/* Real World Equivalents */}
      <div
        className="card p-4 border space-y-2.5"
        style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
      >
        <h3 className="font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
          Real World Equivalents ✦
        </h3>
        <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: 'var(--cream)' }}>
          <span className="text-xl">🌳</span>
          <p className="text-xs text-gray-700">
            Equals <strong>{treeDays} days</strong> of oxygen production by a mature tree.
          </p>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: 'var(--cream)' }}>
          <span className="text-xl">🛁</span>
          <p className="text-xs text-gray-700">
            Saved enough water to fill over <strong>{bathtubs} standard bathtubs</strong>.
          </p>
        </div>
      </div>

      {/* Shareable Impact Card CTA */}
      <div
        onClick={handleShare}
        className="p-4 rounded-3xl border text-center cursor-pointer transition-transform active:scale-98 shadow-sm"
        style={{
          backgroundColor: '#EEF4E9',
          borderColor: 'var(--green-sage)'
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--green-forest)', fontFamily: "'Fredoka', sans-serif" }}>
          ✦ Share Your Impact ✦
        </p>
        <p className="text-xs text-gray-700 italic mb-2">"{shareText}"</p>
        <button
          type="button"
          className="text-xs font-bold px-4 py-1.5 rounded-full text-white shadow-xs"
          style={{ backgroundColor: 'var(--green-sage)', fontFamily: "'Fredoka', sans-serif" }}
        >
          {copied ? '✓ Copied to Clipboard!' : 'Copy Share Card 📋'}
        </button>
      </div>
    </div>
  );
}
