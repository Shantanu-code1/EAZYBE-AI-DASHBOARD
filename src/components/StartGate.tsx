'use client'

import { useEffect, useState } from 'react'
import Dashboard from './Dashboard'
import EazybeVerifyOtp from './EazybeVerifyOtp'

function hasEazybeSession() {
  if (typeof window === 'undefined') return false
  return Boolean(localStorage.getItem('eazybe_verify_otp_response') || localStorage.getItem('eazybe_access_token'))
}

export default function StartGate() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(hasEazybeSession())
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Enter your email</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
            We’ll verify and then load the dashboard.
          </p>
          <EazybeVerifyOtp
            className="flex flex-col gap-3"
            onSuccess={() => setReady(true)}
          />
        </div>
      </div>
    )
  }

  return <Dashboard />
}

