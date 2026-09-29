import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuctions } from '../services/auctionService';
import { formatPrice } from '../utils/helpers';
import Spinner from '../components/Spinner';

export default function AuctionPage() {
  const navigate = useNavigate();
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
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getAuctions(tab === 'mine' ? 'all' : tab);
      setAuctions(data);
    } catch (err) {
      console.error('Failed to load auctions', err);
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
          <span className="text-2xl">🔨</span>
          <div>
            <h1 className="text-xl font-bold leading-none" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              Live Auctions ✦
            </h1>
            <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
              Real-time bidding & rare vintage drops
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="text-xs font-semibold px-3 py-1 rounded-full border transition"
          style={{ backgroundColor: 'var(--pink-blush)', borderColor: 'var(--pink-cotton)', color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
        {[
          { key: 'all', label: 'All Drops' },
          { key: 'live', label: 'Live Now 🔴' },
          { key: 'ending', label: 'Ending Soon 🔥' },
          { key: 'upcoming', label: 'Upcoming ⏳' },
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
            className="text-center py-16 rounded-3xl border border-dashed p-6 my-4"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
          >
            <p className="text-4xl mb-2">🏷️</p>
            <h3 className="text-base font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              No auctions in this category right now
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">
              Check back soon for curated vintage auctions dropping every weekend!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {auctions.map(auction => {
              const isLive = auction.status === 'live';
              const isEnding = auction.status === 'ending';
              const isUpcoming = auction.status === 'upcoming';
              const isSettled = auction.status === 'settled' || auction.status === 'closed';

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

                    {/* Status Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      {isLive && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          LIVE NOW
                        </span>
                      )}
                      {isEnding && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ENDING SOON
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="bg-gray-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                          UPCOMING
                        </span>
                      )}
                      {isSettled && (
                        <span className="bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                          CLOSED
                        </span>
                      )}
                    </div>

                    {/* Countdown Overlay */}
                    {!isSettled && !isUpcoming && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                        <span>⏱️</span>
                        <span>{formatCountdown(auction.endTime)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--pink-mauve)' }}>
                        {auction.sellerName}
                      </p>
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
                        <p className="text-[11px] text-gray-400">Activity</p>
                        <p className="text-xs font-semibold" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
                          {auction.bids?.length || 0} bids • {auction.totalBidders || 0} bidders
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
