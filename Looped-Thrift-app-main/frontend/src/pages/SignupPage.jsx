import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import Spinner from '../components/Spinner'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      const r = await api.post('/auth/signup', form)
      // Pass userId to OTP page
      navigate('/verify-otp', { state: { userId: r.data.userId, email: form.email } })
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <h1 className="font-display text-5xl text-pink-500 italic mb-2">Looped</h1>
        <p className="text-gray-500 text-sm">Join the circular fashion movement</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-pink-100 p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Create account</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Full name</label>
            <input className="input" placeholder="Priya Sharma" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required />
          </div>
          <button type="submit" className="btn-primary flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-pink-500 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
