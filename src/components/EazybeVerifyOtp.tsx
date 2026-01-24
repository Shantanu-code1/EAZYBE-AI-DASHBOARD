'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function EazybeVerifyOtp({
  onSuccess,
  className,
}: {
  onSuccess?: () => void
  className?: string
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async () => {
    setError(null)
    setSuccess(false)
    if (!email.trim()) {
      setError('Please enter email')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/eazybe/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'gmail' }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || `Request failed: ${res.status}`)
      }

      localStorage.setItem('eazybe_verify_otp_response', JSON.stringify(data))
      if (data?.data?.access_token) {
        localStorage.setItem('eazybe_access_token', String(data.data.access_token))
      }

      setSuccess(true)
      onSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify otp')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className || 'flex items-center gap-2'}>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email (e.g., anuj@eazybe.com)"
        className="w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
      />
      <button
        onClick={onSubmit}
        disabled={loading}
        className="px-3 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-60 flex items-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Verify OTP
      </button>
      {success && <span className="text-xs text-green-500">Saved to localStorage</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

