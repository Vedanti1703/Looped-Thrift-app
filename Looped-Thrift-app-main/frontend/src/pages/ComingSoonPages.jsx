import { useNavigate } from 'react'
import BottomNav from '../components/BottomNav'
import RentPage from './RentPage'

export { RentPage }

function ComingSoon({ emoji, title, subtitle, description, features }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-pink-50 pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="font-bold text-gray-900">{title}</span>
      </div>

      <div className="flex flex-col items-center justify-center px-8 pt-16 text-center">
        <div className="text-8xl mb-6 animate-bounce">{emoji}</div>
        <h1 className="font-display text-3xl text-gray-900 italic mb-2">{title}</h1>
        <p className="text-pink-500 font-semibold text-lg mb-4">{subtitle}</p>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs">{description}</p>

        <div className="w-full max-w-xs space-y-3 mb-8">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-pink-100 px-4 py-3 flex items-center gap-3 text-left">
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-pink-400 to-rose-400 rounded-2xl px-6 py-4 text-white text-center w-full max-w-xs">
          <p className="font-semibold mb-1">Get notified when it launches!</p>
          <p className="text-xs text-white/70">We're building something special 💕</p>
        </div>

        <button onClick={() => navigate('/')} className="btn-outline max-w-xs mt-4">
          Back to Home
        </button>
      </div>
    </div>
  )
}

export function AuctionPage() {
  return (
    <ComingSoon
      emoji="🔨"
      title="Live Auctions"
      subtitle="Coming Soon 🔥"
      description="Bid on rare vintage finds and limited-edition pieces. The thrill of the hunt — on your phone."
      features={[
        { icon: '⏱️', label: 'Live Bidding', desc: 'Real-time auctions every weekend' },
        { icon: '💎', label: 'Rare Finds', desc: 'Curated vintage & limited items' },
        { icon: '🏆', label: 'Win Big', desc: 'Get designer pieces at thrift prices' },
        { icon: '🔔', label: 'Bid Alerts', desc: 'Never miss an ending auction' },
      ]}
    />
  )
}
