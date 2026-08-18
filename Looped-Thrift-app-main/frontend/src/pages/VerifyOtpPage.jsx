import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function VerifyOtpPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuth()
  const { userId, email } = location.state || {}

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const refs = Array.from({ length: 6 }, () => useRef(null))

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) refs[i + 1].current?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus()
  }

  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg,     setResendMsg]     = useState('')

  const handleResend = async () => {
    setResendLoading(true)
    setResendMsg('')
    try {
      await api.post('/auth/resend-otp', { userId })
      setResendMsg('New code sent!')
      setTimeout(() => setResendMsg(''), 3000)
    } catch {
      setResendMsg('Failed to resend. Try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length < 6) return setError('Enter all 6 digits')
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/verify-otp', { userId, otp })
      login(r.data.token, r.data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <h1 className="font-display text-5xl text-pink-500 italic mb-2">Looped</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-pink-100 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📧</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Verify your email</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter the OTP sent to <strong>{email}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Check your email inbox (and spam folder)
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 mb-6">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={refs[i]}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                maxLength={1}
                className="w-11 h-12 text-center text-xl font-bold border-2 border-pink-200
                           rounded-xl focus:outline-none focus:border-pink-400 bg-pink-50
                           transition-colors"
              />
            ))}
          </div>
          <button type="submit" className="btn-primary flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Verify & Continue'}
          </button>

          <div className="text-center mt-4">
            <p className="text-xs text-gray-400 mb-2">Didn't receive the code?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="text-pink-500 text-sm font-semibold hover:underline disabled:opacity-50"
            >
              {resendLoading ? 'Sending…' : 'Resend Code'}
            </button>
            {resendMsg && <p className="text-xs text-green-600 mt-1">{resendMsg}</p>}
          </div>
        </form>
      </div>
    </div>
  )
}
