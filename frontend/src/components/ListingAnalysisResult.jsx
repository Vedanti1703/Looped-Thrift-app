import React from 'react';

export default function ListingAnalysisResult({ analysis, onProceed, onFixIssues }) {
  if (!analysis) return null;

  const { verdict, results } = analysis;
  const isApproved = verdict === 'approved';
  const isReview = verdict === 'review';
  const isRejected = verdict === 'rejected';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl border relative overflow-hidden"
        style={{
          backgroundColor: 'var(--ivory)',
          borderColor: 'var(--pink-cotton)',
          boxShadow: 'var(--shadow)'
        }}
      >
        {/* Header verdict badge */}
        <div className="text-center mb-4">
          <div
            className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-3xl shadow-sm mb-2"
            style={{
              backgroundColor: isApproved ? '#DCEEDC' : isReview ? '#FFF1C5' : '#FBE9EF',
              color: isApproved ? 'var(--green-forest)' : isReview ? '#8A6A3D' : 'var(--pink-deep)'
            }}
          >
            {isApproved ? '✓' : isReview ? '⚠️' : '🛑'}
          </div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
            {isApproved ? 'Listing Looks Great! ✦' : isReview ? 'Quality & Authenticity Review' : 'Listing Needs Changes'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#6b5560' }}>
            {isApproved
              ? 'Passed all anti-fraud, pricing, and photo consistency checks.'
              : isReview
              ? 'Our AI detected minor flags. You can review them before publishing.'
              : 'Our fraud detection system flagged issues that must be corrected.'}
          </p>
        </div>

        {/* Detailed checks breakdown */}
        <div className="space-y-2.5 my-4 max-h-64 overflow-y-auto pr-1">
          {/* Price Check */}
          <div
            className="p-3 rounded-2xl border text-xs flex items-start gap-2.5"
            style={{
              backgroundColor: results.price?.flag ? '#FFF7F2' : 'var(--cream)',
              borderColor: 'var(--pink-cotton)'
            }}
          >
            <span className="text-base">{results.price?.flag ? '⚠️' : '💰'}</span>
            <div>
              <p className="font-bold" style={{ color: 'var(--pink-mauve)' }}>Price Valuation Check</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {results.price?.flag ? results.price.reason : 'Price is within expected marketplace benchmarks.'}
              </p>
            </div>
          </div>

          {/* Duplicate Check */}
          <div
            className="p-3 rounded-2xl border text-xs flex items-start gap-2.5"
            style={{
              backgroundColor: results.duplicate?.flag ? '#FFF7F2' : 'var(--cream)',
              borderColor: 'var(--pink-cotton)'
            }}
          >
            <span className="text-base">{results.duplicate?.flag ? '⚠️' : '🔍'}</span>
            <div>
              <p className="font-bold" style={{ color: 'var(--pink-mauve)' }}>Duplicate Listing Check</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {results.duplicate?.flag ? results.duplicate.reason : 'No duplicate listings detected on your account.'}
              </p>
            </div>
          </div>

          {/* AI Vision Consistency */}
          <div
            className="p-3 rounded-2xl border text-xs flex items-start gap-2.5"
            style={{
              backgroundColor: results.ai?.overallRisk === 'high' ? '#FBE9EF' : 'var(--cream)',
              borderColor: 'var(--pink-cotton)'
            }}
          >
            <span className="text-base">🤖</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold" style={{ color: 'var(--pink-mauve)' }}>AI Vision Consistency</p>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{
                    backgroundColor: results.ai?.overallRisk === 'high' ? 'var(--pink-hot)' : 'var(--green-sage)',
                    color: '#fff'
                  }}
                >
                  {results.ai?.overallRisk || 'low'} risk
                </span>
              </div>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {results.ai?.damageDescription
                  ? `Noticed: ${results.ai.damageDescription}`
                  : 'Photo, claimed category, and condition appear consistent.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5 mt-5">
          {isRejected ? (
            <button
              type="button"
              onClick={onFixIssues}
              className="btn-primary w-full py-3 text-xs flex items-center justify-center gap-2"
            >
              Fix Issues & Edit Form
            </button>
          ) : isReview ? (
            <>
              <button
                type="button"
                onClick={onFixIssues}
                className="btn-outline flex-1 py-3 text-xs"
              >
                Edit Form
              </button>
              <button
                type="button"
                onClick={onProceed}
                className="btn-primary flex-1 py-3 text-xs"
              >
                Publish Anyway ✦
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onProceed}
              className="btn-primary w-full py-3 text-xs flex items-center justify-center gap-2 shadow-md"
            >
              Confirm & Publish Listing ✦
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
