import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/login', { email, password })
      login(r.data.token, r.data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #fff 0%, #FBDCE8 55%, #F5A9C9 100%)'
      }}
    >
      {/* 3 decorative ✦ stars in gold and pink */}
      <span className="absolute top-12 left-10 text-2xl select-none animate-pulse" style={{ color: 'var(--gold)' }}>✦</span>
      <span className="absolute top-28 right-12 text-3xl select-none" style={{ color: 'var(--pink-hot)', filter: 'drop-shadow(0 2px 8px rgba(236,111,167,0.4))' }}>✦</span>
      <span className="absolute bottom-16 left-12 text-xl select-none" style={{ color: 'var(--pink-deep)' }}>✦</span>

      {/* Brand */}
      <div className="text-center mb-6 z-10">
        <h1
          className="text-6xl mb-1 select-none"
          style={{ fontFamily: "'Parisienne', cursive", color: 'var(--pink-deep)' }}
        >
          Looped
        </h1>
        <p className="text-sm font-medium" style={{ color: 'var(--pink-mauve)' }}>
          your closet, always in rotation ✦
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-3xl p-8 z-10 shadow-lg relative border"
        style={{
          backgroundColor: 'rgba(255, 253, 249, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'var(--pink-cotton)',
          boxShadow: 'var(--shadow)'
        }}
      >
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
          Welcome back
        </h2>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
              Email
            </label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
              Password
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Sign In ✦'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--ink)' }}>
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold hover:underline" style={{ color: 'var(--pink-hot)', fontFamily: "'Fredoka', sans-serif" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
