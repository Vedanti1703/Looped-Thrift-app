import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminAuctions, verifyAuction } from '../services/auctionService';
import { formatPrice } from '../utils/helpers';
import Spinner from '../components/Spinner';

export default function AdminAuctionVerificationPage() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'verified' | 'rejected' | 'all'
  const [reviewModal, setReviewModal] = useState(null); // auction being reviewed
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAdminAuctions();
  }, [filter]);

  const fetchAdminAuctions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminAuctions(filter);
      setAuctions(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Access denied: Admin privileges required.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (action) => {
    if (!reviewModal) return;
    if (action === 'reject' && !reviewNote.trim()) {
      alert('Please provide a rejection note so the seller understands what proof is missing.');
      return;
    }

    setActionLoading(true);
    try {
      await verifyAuction(reviewModal._id, action, reviewNote.trim());
      setSuccess(`Auction #${reviewModal._id.slice(-6)} was successfully ${action === 'approve' ? 'verified' : 'rejected'}.`);
      setReviewModal(null);
      setReviewNote('');
      fetchAdminAuctions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update verification status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.94)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/auction')} className="p-1 rounded-full hover:bg-pink-100 transition text-gray-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold leading-none" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              🛡️ Luxury Drop Verification
            </h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Admin Authentication & Proof Review</p>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
          Admin Portal
        </span>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Filter Pills */}
        <div className="flex gap-2">
          {[
            { id: 'pending', label: '⏳ Pending Review' },
            { id: 'verified', label: '✓ Verified' },
            { id: 'rejected', label: '✕ Rejected' },
            { id: 'all', label: 'All' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-full font-bold transition ${
                filter === tab.id ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 border border-pink-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3.5 rounded-2xl font-medium text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-2xl font-semibold text-center">
            {success}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-pink-100 p-6">
            <p className="text-3xl mb-2">✨</p>
            <p className="text-sm font-bold text-gray-700">No auctions matching "{filter}"</p>
            <p className="text-xs text-gray-400 mt-1">All luxury drops have been processed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auctions.map(item => (
              <div
                key={item._id}
                className="card p-4 border rounded-2xl bg-white space-y-3"
                style={{ borderColor: 'var(--pink-cotton)' }}
              >
                <div className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-20 h-20 rounded-xl object-cover border border-pink-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-pink-100 text-pink-700">
                        {item.brand}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                        item.verificationStatus === 'rejected' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.verificationStatus.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-xs font-bold text-gray-800 truncate mt-1">{item.title}</h2>
                    <p className="text-[11px] text-gray-500">
                      Seller: <strong>{item.sellerName}</strong> • Value: <strong>{formatPrice(item.declaredValue)}</strong>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Photos: {item.images?.length || 1} • Proof Docs: {item.proofDocs?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Proof Docs preview buttons */}
                <div className="pt-2 border-t flex items-center justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    {item.proofDocs?.map((doc, i) => (
                      <a
                        key={i}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"
                      >
                        📄 {doc.type}
                      </a>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setReviewModal(item);
                      setReviewNote(item.verificationNote || '');
                    }}
                    className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-pink-500 text-white hover:bg-pink-600 transition"
                  >
                    Review Drop 🔍
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 border border-pink-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                Verify Drop: {reviewModal.title}
              </h3>
              <button onClick={() => setReviewModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* AI Vision Hint if available */}
            {reviewModal.aiFraudHint && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs space-y-1">
                <p className="font-bold text-purple-900 flex items-center gap-1">
                  🤖 AI Vision Fraud Hint (Advisory Only)
                </p>
                <p className="text-purple-700 text-[11px]">
                  Risk: <strong>{reviewModal.aiFraudHint.overallRisk || 'low'}</strong> • Recommendation: <strong>{reviewModal.aiFraudHint.recommendation || 'approve'}</strong>
                </p>
                {reviewModal.aiFraudHint.damageDescription && (
                  <p className="text-purple-600 text-[10px]">Note: {reviewModal.aiFraudHint.damageDescription}</p>
                )}
              </div>
            )}

            {/* Gallery images */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Item Photos ({reviewModal.images?.length || 1})</p>
              <div className="grid grid-cols-3 gap-2">
                {(reviewModal.images?.length ? reviewModal.images : [reviewModal.image]).map((img, i) => (
                  <a key={i} href={img} target="_blank" rel="noreferrer" className="block h-20 rounded-xl overflow-hidden border">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>

            {/* Proof Documents */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Confidential Proof Documents</p>
              <div className="space-y-1.5">
                {reviewModal.proofDocs?.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border text-xs">
                    <div>
                      <span className="font-bold text-gray-800 uppercase text-[10px] bg-gray-200 px-1.5 py-0.5 rounded mr-2">
                        {doc.type}
                      </span>
                      <span className="text-gray-600 truncate">{doc.originalName || 'Proof Document'}</span>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-600 font-bold hover:underline ml-2 flex-shrink-0"
                    >
                      View / Download ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Note */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Verification / Rejection Note:
              </label>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Add verification hallmarking details or reason for rejection..."
                rows={2}
                className="input text-xs"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleDecision('reject')}
                className="flex-1 py-2.5 rounded-xl border border-rose-300 text-rose-600 font-bold text-xs hover:bg-rose-50 transition"
              >
                ✕ Reject Drop
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleDecision('approve')}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition flex items-center justify-center gap-1 shadow-sm"
              >
                {actionLoading ? <Spinner size="sm" /> : '✓ Approve & Verify Drop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
