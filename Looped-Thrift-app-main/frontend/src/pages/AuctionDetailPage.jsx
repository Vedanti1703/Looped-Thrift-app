import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuction, placeBid } from '../services/auctionService';
import { formatPrice, formatRelativeTime } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(Date.now());
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  // Real-time second counter
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch auction details & poll every 5 seconds
  useEffect(() => {
    fetchAuctionData();
    const interval = setInterval(fetchAuctionData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchAuctionData = async () => {
    try {
      const data = await getAuction(id);
      setAuction(data);
      if (!bidAmount && data) {
        setBidAmount(data.currentPrice + (data.incrementAmount || 250));
      }
    } catch (err) {
      console.error('Failed to load auction', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!token) return navigate('/login', { state: { from: `/auction/${id}` } });

    const amountNum = Number(bidAmount);
    const minNext = auction.currentPrice + (auction.incrementAmount || 250);
    if (amountNum < minNext) {
      setError(`Minimum bid is ${formatPrice(minNext)}`);
      return;
    }

    setBidding(true);
    setError('');
    setSuccess('');
    try {
      const updated = await placeBid(id, amountNum);
      setAuction(updated);
      setSuccess('Your bid was placed successfully! 🎉');
      setBidAmount(updated.currentPrice + (updated.incrementAmount || 250));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bid. Please try again.');
    } finally {
      setBidding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: 'var(--cream)' }}>
        <p className="text-4xl mb-2">🔍</p>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
          Auction not found
        </h2>
        <button onClick={() => navigate('/auction')} className="btn-primary">Back to Auctions</button>
      </div>
    );
  }

  const isLive = auction.status === 'live';
  const isEnding = auction.status === 'ending';
  const isSettled = auction.status === 'settled';
  const isClosed = auction.status === 'closed';

  const totalSecs = Math.max(0, Math.floor((new Date(auction.endTime).getTime() - now) / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const minNextBid = auction.currentPrice + (auction.incrementAmount || 250);

  // Check user's current bid status
  const currentUserId = user?._id || user?.id;
  const highestBid = auction.bids?.find(b => b.isWinning) || auction.bids?.[auction.bids.length - 1];
  const isUserWinning = currentUserId && highestBid && highestBid.bidderId?.toString() === currentUserId?.toString();
  const hasUserBid = currentUserId && auction.bids?.some(b => b.bidderId?.toString() === currentUserId?.toString());
  const isUserOutbid = hasUserBid && !isUserWinning && (isLive || isEnding);

  const imagesList = auction.images && auction.images.length > 0 ? auction.images : [auction.image];

  // Anonymize name: "Priya Sharma" -> "Priya S."
  const anonymize = (name) => {
    if (!name) return 'Bidder';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3 flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.94)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <button onClick={() => navigate('/auction')} className="p-1 rounded-full hover:bg-pink-100 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-sm truncate flex-1" style={{ color: 'var(--pink-mauve)' }}>
          {auction.title}
        </h1>
        {auction.verificationStatus === 'verified' && (
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
            <span>🛡️</span> Verified by Looped
          </span>
        )}
      </div>

      {/* Hero Image & Gallery Carousel */}
      <div className="relative max-w-lg mx-auto overflow-hidden bg-pink-50">
        <div className="relative h-[380px] w-full">
          <img
            src={imagesList[selectedImageIdx] || auction.image}
            alt={auction.title}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {/* Live Badge */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {(isLive || isEnding) && (
              <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                {isEnding ? 'ENDING SOON' : 'LIVE AUCTION'}
              </span>
            )}
            <span className="bg-white/90 backdrop-blur text-pink-700 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              💎 {auction.brand || 'Luxury Drop'}
            </span>
          </div>

          {/* Image count pill */}
          {imagesList.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-xs">
              {selectedImageIdx + 1} / {imagesList.length}
            </div>
          )}
        </div>

        {/* Gallery Thumbnails */}
        {imagesList.length > 1 && (
          <div className="flex gap-2 p-3 bg-white/70 border-b overflow-x-auto scrollbar-none" style={{ borderColor: 'var(--pink-cotton)' }}>
            {imagesList.map((imgUrl, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImageIdx(idx)}
                className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                  selectedImageIdx === idx ? 'border-pink-500 scale-105 shadow-sm' : 'border-gray-200 opacity-70'
                }`}
              >
                <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Details & Live Bid Stats */}
      <div className="p-5 max-w-lg mx-auto space-y-4">
        {/* Title, Brand, Category & Authenticity Badge */}
        <div
          className="card p-5 border"
          style={{
            backgroundColor: 'var(--ivory)',
            borderColor: 'var(--pink-cotton)',
            borderRadius: '24px'
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                  {auction.brand}
                </span>
                <span className="text-xs font-semibold text-gray-500">
                  {auction.category}
                </span>
                {auction.size && (
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                    Size: {auction.size}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold leading-tight mt-1" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
                {auction.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span>Curated Drop by <strong>{auction.sellerName}</strong></span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              ✓ Verified by Looped
            </span>
          </div>

          <p className="text-xs leading-relaxed text-gray-700">
            {auction.description || 'Authenticated luxury designer piece.'}
          </p>

          {/* Authenticity Guarantee Card */}
          <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <p className="text-xs font-bold text-pink-900">Looped Luxury Guarantee</p>
              <p className="text-[10px] text-pink-700">
                Purchase invoice and provenance verified by Looped specialists before listing.
              </p>
            </div>
          </div>

          {/* Current Highest Bid Highlight */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--pink-cotton)' }}>
            <div>
              <p className="text-xs text-gray-500 font-medium">Current Highest Bid</p>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>
                {formatPrice(auction.currentPrice)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Declared Retail Value</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{formatPrice(auction.declaredValue || 5000)}</p>
              <p className="text-[10px] text-gray-400">Starting: {formatPrice(auction.startingPrice)}</p>
            </div>
          </div>
        </div>

        {/* Live Countdown Clock */}
        <div
          className="rounded-3xl p-5 text-center border shadow-sm"
          style={{
            background: 'linear-gradient(135deg, var(--pink-rose), var(--pink-hot))',
            borderColor: 'var(--pink-cotton)',
            color: '#fff'
          }}
        >
          <p className="text-xs uppercase font-bold tracking-widest text-white/90 mb-2" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            {isSettled ? '✦ AUCTION SETTLED ✦' : isClosed ? '✦ AUCTION CLOSED ✦' : '✦ TIME REMAINING ✦'}
          </p>

          {isSettled || isClosed ? (
            <div className="py-2">
              <p className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                {isSettled ? `Winner: ${anonymize(auction.winnerName)} (${formatPrice(auction.winnerBid)}) 🎉` : 'Reserve Price Not Met'}
              </p>
            </div>
          ) : (
            <div className="flex justify-center items-center gap-3 my-1">
              {days > 0 && (
                <div className="bg-white/20 backdrop-blur-xs rounded-2xl px-3 py-2 min-w-[60px]">
                  <p className="text-2xl font-black">{days}</p>
                  <p className="text-[10px] uppercase font-bold">Days</p>
                </div>
              )}
              <div className="bg-white/20 backdrop-blur-xs rounded-2xl px-3 py-2 min-w-[60px]">
                <p className="text-2xl font-black">{hours.toString().padStart(2, '0')}</p>
                <p className="text-[10px] uppercase font-bold">Hours</p>
              </div>
              <span className="text-2xl font-bold">:</span>
              <div className="bg-white/20 backdrop-blur-xs rounded-2xl px-3 py-2 min-w-[60px]">
                <p className="text-2xl font-black">{mins.toString().padStart(2, '0')}</p>
                <p className="text-[10px] uppercase font-bold">Mins</p>
              </div>
              <span className="text-2xl font-bold">:</span>
              <div className="bg-white/20 backdrop-blur-xs rounded-2xl px-3 py-2 min-w-[60px]">
                <p className="text-2xl font-black">{secs.toString().padStart(2, '0')}</p>
                <p className="text-[10px] uppercase font-bold">Secs</p>
              </div>
            </div>
          )}

          {/* Anti-snipe notice */}
          {(isLive || isEnding) && (
            <p className="text-[11px] text-white/80 mt-2">
              ⚡ Anti-snipe protection active: bids in the last 5 mins extend the auction by 2 minutes.
            </p>
          )}
        </div>

        {/* User Winning / Outbid Status Banners */}
        {isUserWinning && (
          <div className="rounded-2xl p-3.5 border text-center font-bold text-sm" style={{ backgroundColor: '#DCEEDC', borderColor: 'var(--green-sage)', color: 'var(--green-forest)' }}>
            🎉 You currently hold the highest winning bid!
          </div>
        )}
        {isUserOutbid && (
          <div className="rounded-2xl p-3.5 border text-center font-bold text-sm bg-rose-50 border-rose-300 text-rose-700">
            ⚠️ You have been outbid! Place a higher bid to get back on top.
          </div>
        )}

        {/* Place Bid Section */}
        {(isLive || isEnding) && (
          <div
            className="card p-5 border"
            style={{
              backgroundColor: 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              borderRadius: '24px'
            }}
          >
            <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              Place Your Bid ✦
            </h2>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl mb-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl mb-3 font-semibold">
                {success}
              </div>
            )}

            <form onSubmit={handlePlaceBid} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-bold block mb-1 text-gray-500">
                    Your Bid Amount (Min: {formatPrice(minNextBid)})
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    min={minNextBid}
                    step={auction.incrementAmount || 250}
                    className="input text-lg font-bold"
                    placeholder={`e.g. ${minNextBid}`}
                    required
                  />
                </div>
              </div>

              {/* Luxury increment buttons */}
              <div className="flex gap-2">
                {[250, 500, 1000, 2500].map(inc => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setBidAmount(minNextBid + inc)}
                    className="flex-1 py-1 text-xs font-semibold rounded-xl border transition hover:bg-pink-100"
                    style={{ backgroundColor: 'var(--pink-blush)', borderColor: 'var(--pink-cotton)', color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}
                  >
                    +{inc}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={bidding}
                className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 shadow-md"
              >
                {bidding ? <Spinner size="sm" /> : `Confirm Bid • ${formatPrice(Number(bidAmount) || minNextBid)} ✦`}
              </button>
            </form>
          </div>
        )}

        {/* Live Bid History */}
        <div
          className="card p-5 border space-y-3"
          style={{
            backgroundColor: 'var(--ivory)',
            borderColor: 'var(--pink-cotton)',
            borderRadius: '24px'
          }}
        >
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              Bid History ✦
            </h2>
            <span className="text-xs font-semibold" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
              {auction.bids?.length || 0} Total Bids
            </span>
          </div>

          {!auction.bids || auction.bids.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center italic">
              No bids placed yet. Be the first to start the auction!
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[...auction.bids].reverse().map((bid, i) => (
                <div
                  key={bid._id || i}
                  className="flex items-center justify-between p-3 rounded-2xl border text-xs"
                  style={{
                    backgroundColor: bid.isWinning ? 'var(--pink-blush)' : 'var(--cream)',
                    borderColor: bid.isWinning ? 'var(--pink-hot)' : 'var(--pink-cotton)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {bid.isWinning ? '👑' : '🏷️'}
                    </span>
                    <div>
                      <p className="font-bold" style={{ color: 'var(--ink)' }}>
                        {anonymize(bid.bidderName)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {formatRelativeTime(bid.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-sm" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>
                      {formatPrice(bid.amount)}
                    </p>
                    {bid.isWinning && (
                      <span className="text-[10px] font-bold text-emerald-700">Winning</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
