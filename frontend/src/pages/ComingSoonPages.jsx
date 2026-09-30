import { useNavigate } from 'react-router-dom'
import RentPage from './RentPage'

export { RentPage }

function RetroTV({ text = "coming soon ✦" }) {
  return (
    <div className="relative w-64 h-52 mx-auto my-4 flex items-center justify-center">
      <svg viewBox="0 0 240 200" className="w-full h-full drop-shadow-lg">
        <defs>
          <linearGradient id="tvBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F6C6DC" />
            <stop offset="100%" stopColor="#EC6FA7" />
          </linearGradient>
          <linearGradient id="antennaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D8B589" />
            <stop offset="100%" stopColor="#C94E82" />
          </linearGradient>
        </defs>

        {/* Antennas */}
        <line x1="85" y1="50" x2="45" y2="15" stroke="url(#antennaGrad)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="43" cy="13" r="5" fill="#D8B589" />
        <line x1="155" y1="50" x2="195" y2="15" stroke="url(#antennaGrad)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="197" cy="13" r="5" fill="#D8B589" />

        {/* TV Base / Legs */}
        <line x1="60" y1="180" x2="45" y2="198" stroke="#8F3F63" strokeWidth="6" strokeLinecap="round" />
        <line x1="180" y1="180" x2="195" y2="198" stroke="#8F3F63" strokeWidth="6" strokeLinecap="round" />

        {/* TV Outer Cabinet */}
        <rect x="20" y="45" width="200" height="140" rx="28" fill="url(#tvBodyGrad)" stroke="#8F3F63" strokeWidth="3" />

        {/* TV Screen Surround */}
        <rect x="34" y="58" width="138" height="114" rx="20" fill="#3B2A32" />

        {/* TV Inner Screen (Cream) */}
        <rect x="38" y="62" width="130" height="106" rx="16" fill="#FBF4EC" />

        {/* Dial panel */}
        <circle cx="192" cy="80" r="12" fill="#FFFDF9" stroke="#8F3F63" strokeWidth="2.5" />
        <line x1="192" y1="72" x2="192" y2="88" stroke="#EC6FA7" strokeWidth="2.5" strokeLinecap="round" />

        <circle cx="192" cy="115" r="12" fill="#FFFDF9" stroke="#8F3F63" strokeWidth="2.5" />
        <line x1="184" y1="115" x2="200" y2="115" stroke="#EC6FA7" strokeWidth="2.5" strokeLinecap="round" />

        {/* Speaker vents */}
        <line x1="182" y1="145" x2="202" y2="145" stroke="#8F3F63" strokeWidth="2" strokeLinecap="round" />
        <line x1="182" y1="152" x2="202" y2="152" stroke="#8F3F63" strokeWidth="2" strokeLinecap="round" />
        <line x1="182" y1="159" x2="202" y2="159" stroke="#8F3F63" strokeWidth="2" strokeLinecap="round" />

        {/* Decorative sparkles */}
        <text x="145" y="80" fontSize="14" fill="#D8B589">✦</text>
        <text x="46" y="156" fontSize="12" fill="#EC6FA7">✦</text>
      </svg>

      {/* Screen Text overlay in Parisienne */}
      <div className="absolute left-[38px] top-[74px] w-[116px] h-[82px] flex items-center justify-center text-center px-1">
        <span
          className="text-xl leading-tight"
          style={{
            fontFamily: "'Parisienne', cursive",
            color: 'var(--pink-deep)',
            textShadow: '0 1px 2px rgba(236,111,167,0.2)'
          }}
        >
          {text}
        </span>
      </div>
    </div>
  )
}

function ComingSoon({ title, subtitle, description, features, tvText = "coming soon ✦" }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--cream)' }}>
      <div
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3 border-b"
        style={{
          backgroundColor: 'rgba(251,244,236,0.92)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-pink-100 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pink-mauve)" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
          {title}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center px-8 pt-8 text-center">
        {/* Retro TV Illustration */}
        <RetroTV text={tvText} />

        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-deep)' }}>
          {title} ✦
        </h1>
        <p className="text-base mb-3 font-semibold" style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--pink-hot)' }}>
          {subtitle}
        </p>
        <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: 'var(--ink)' }}>
          {description}
        </p>

        <div className="w-full max-w-xs space-y-3 mb-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="card px-4 py-3 flex items-center gap-3 text-left"
              style={{
                backgroundColor: 'var(--ivory)',
                borderColor: 'var(--pink-cotton)',
                borderRadius: '18px'
              }}
            >
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
                  {f.label}
                </p>
                <p className="text-xs" style={{ color: '#6b5560' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl px-6 py-4 text-white text-center w-full max-w-xs shadow-md"
          style={{
            background: 'linear-gradient(135deg, var(--pink-rose), var(--pink-hot))',
            borderRadius: '20px'
          }}
        >
          <p className="font-semibold mb-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            Get notified when it launches! ✦
          </p>
          <p className="text-xs text-white/90">We're building something special 💕</p>
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
      title="Live Auctions"
      subtitle="Coming Soon ✦"
      description="Bid on rare vintage finds and limited-edition pieces. The thrill of the hunt — on your phone."
      tvText="Live Auction ✦"
      features={[
        { icon: '⏱️', label: 'Live Bidding', desc: 'Real-time auctions every weekend' },
        { icon: '💎', label: 'Rare Finds', desc: 'Curated vintage & limited items' },
        { icon: '🏆', label: 'Win Big', desc: 'Get designer pieces at thrift prices' },
        { icon: '🔔', label: 'Bid Alerts', desc: 'Never miss an ending auction' },
      ]}
    />
  )
}
