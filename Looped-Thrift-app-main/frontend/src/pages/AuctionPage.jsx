import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuctions, getMyAuctions } from '../services/auctionService';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/helpers';
import Spinner from '../components/Spinner';

export default function AuctionPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [tab, setTab] = useState('all'); // 'all' | 'live' | 'ending' | 'upcoming' | 'mine'
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Real-time second counter for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
  }, [tab, token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'mine') {
        if (!token) {
          setAuctions([]);
          setLoading(false);
          return;
        }
        const data = await getMyAuctions();
        setAuctions(data || []);
      } else {
        const data = await getAuctions(tab);
        setAuctions(data || []);
      }
    } catch (err) {
      console.error('Failed to load auctions', err);
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (endTimeStr) => {
    const totalSecs = Math.max(0, Math.floor((new Date(endTimeStr).getTime() - now) / 1000));
    if (totalSecs <= 0) return 'Ended';
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h left`;
    }
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isAdmin = user?.role === 'admin' || user?.email?.includes('admin@looped.app');

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.94)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">💎</span>
          <div>
            <h1 className="text-xl font-bold leading-none" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              Luxury Drops ✦
            </h1>
            <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
              Verified Designer & Couture Auctions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin/auctions')}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200 transition"
              title="Admin drop verification portal"
            >
              🛡️ Admin Reviews
            </button>
          )}
          <button
            onClick={() => navigate('/auction/create')}
            className="flex items-center gap-1 text-xs font-bold px-3.5 py-1.5 rounded-full text-white shadow-xs transition hover:opacity-95"
            style={{ backgroundColor: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}
            title="Submit luxury item for drop"
          >
            <span className="text-sm leading-none">+</span> Submit Drop
          </button>
          <button
            onClick={fetchData}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-full border transition"
            style={{ backgroundColor: 'var(--pink-blush)', borderColor: 'var(--pink-cotton)', color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}
            title="Refresh auctions"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {[
          { key: 'all', label: 'All Luxury Drops' },
          { key: 'live', label: 'Live Now 🔴' },
          { key: 'ending', label: 'Ending Soon 🔥' },
          { key: 'upcoming', label: 'Upcoming ⏳' },
          { key: 'mine', label: 'My Drops & Bids 🙋‍♀️' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3.5 py-1.5 rounded-full font-semibold flex-shrink-0 transition-all ${
              tab === t.key ? 'text-white shadow-xs' : 'border'
            }`}
            style={{
              backgroundColor: tab === t.key ? 'var(--pink-hot)' : 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: tab === t.key ? '#fff' : 'var(--pink-mauve)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Spinner size="lg" />
          </div>
        ) : auctions.length === 0 ? (
          <div
            className="text-center py-16 rounded-3xl border border-dashed p-6 my-4 space-y-3"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
          >
            <p className="text-4xl animate-bounce">💎</p>
            <h3 className="text-base font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              {tab === 'mine'
                ? (!token ? 'Log in to view your auctions and bids' : "You haven't submitted or bid on any luxury drops yet")
                : 'No luxury drops in this category right now'}
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              {tab === 'mine'
                ? (!token ? 'Sign in to access your personal drops, verification status, and bidding history.' : 'Submit your designer pieces for authentication or explore live verified drops!')
                : 'All auction drops undergo rigorous authenticity verification. Check back soon or submit your luxury piece!'}
            </p>
            <div className="pt-2">
              {tab === 'mine' && !token ? (
                <button
                  onClick={() => navigate('/login', { state: { from: '/auction' } })}
                  className="btn-primary text-xs px-5 py-2.5 shadow-md"
                >
                  Log In to View ✦
                </button>
              ) : (
                <button
                  onClick={() => navigate('/auction/create')}
                  className="btn-primary text-xs px-5 py-2.5 shadow-md inline-flex items-center gap-1.5"
                >
                  <span>+</span> Submit a Luxury Drop ✦
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {auctions.map(auction => {
              const isLive = auction.status === 'live';
              const isEnding = auction.status === 'ending';
              const isUpcoming = auction.status === 'upcoming';
              const isSettled = auction.status === 'settled' || auction.status === 'closed';
              const vStatus = auction.verificationStatus;

              return (
                <div
                  key={auction._id}
                  onClick={() => navigate(`/auction/${auction._id}`)}
                  className="card cursor-pointer group hover:shadow-lg transition-all overflow-hidden flex flex-col justify-between relative"
                  style={{
                    backgroundColor: 'var(--ivory)',
                    borderColor: 'var(--pink-cotton)',
                    borderRadius: '22px'
                  }}
                >
                  {/* Image & Badges */}
                  <div className="relative h-56 overflow-hidden" style={{ backgroundColor: 'var(--pink-blush)' }}>
                    <img
                      src={auction.image}
                      alt={auction.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Verification & Live Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                      {tab === 'mine' && vStatus === 'pending' && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                          ⏳ Verification Pending
                        </span>
                      )}
                      {tab === 'mine' && vStatus === 'rejected' && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1" title={auction.verificationNote}>
                          ✕ Rejected: {auction.verificationNote?.slice(0, 20) || 'Review details'}
                        </span>
                      )}
                      {vStatus === 'verified' && isLive && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          LIVE NOW
                        </span>
                      )}
                      {vStatus === 'verified' && isEnding && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ENDING SOON
                        </span>
                      )}
                      {vStatus === 'verified' && isUpcoming && (
                        <span className="bg-gray-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                          UPCOMING DROP
                        </span>
                      )}
                      {isSettled && (
                        <span className="bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                          CLOSED
                        </span>
                      )}
                    </div>

                    {/* Brand Pill */}
                    <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs text-pink-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                      {auction.brand || 'Designer'}
                    </div>

                    {/* Countdown Overlay */}
                    {vStatus === 'verified' && !isSettled && !isUpcoming && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                        <span>⏱️</span>
                        <span>{formatCountdown(auction.endTime)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span style={{ color: 'var(--pink-mauve)' }}>{auction.sellerName}</span>
                        <span className="text-[10px] text-gray-400">{auction.category}</span>
                      </div>
                      <h2 className="text-sm font-bold leading-snug mb-2" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)' }}>
                        {auction.title}
                      </h2>
                    </div>

                    <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--pink-cotton)' }}>
                      <div>
                        <p className="text-[11px] text-gray-400">Current Bid</p>
                        <p className="text-lg font-bold" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>
                          {formatPrice(auction.currentPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-gray-400">Declared Value</p>
                        <p className="text-xs font-bold text-gray-700">
                          {formatPrice(auction.declaredValue || 5000)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
