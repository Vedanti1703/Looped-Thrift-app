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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex flex-col items-center justify-center px-6">
      {/* Brand */}
      <div className="text-center mb-8">
        <h1 className="font-display text-5xl text-pink-500 italic mb-2">Looped</h1>
        <p className="text-gray-500 text-sm">Fashion thrift. Sustainably yours.</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-pink-100 p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Welcome back</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-pink-500 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
