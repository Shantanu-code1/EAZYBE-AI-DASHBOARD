'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

function OAuthCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'exchanging' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Processing OAuth callback...')

  const exchangeToken = useCallback(async (code: string, name: string, workspaceId: string, orgId: string) => {
    setStatus('exchanging')
    setMessage('Exchanging authorization code for token...')

    try {
      const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:8000'

      const response = await fetch(`${apiUrl}/hubspot/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: `${window.location.origin}/oauth-callback`,
          name: name.trim(),
          workspace_id: workspaceId.trim(),
          org_id: orgId.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorData}`)
      }

      const data = await response.json()

      // Store tokens locally
      localStorage.setItem('hubspot_access_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('hubspot_refresh_token', data.refresh_token)
      if (data.expires_in) {
        localStorage.setItem('hubspot_token_expires_at', String(Date.now() + data.expires_in * 1000))
      }

      setStatus('success')
      setMessage('Token received successfully!')

      setTimeout(() => router.push('/'), 2000)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to exchange authorization code')
    }
  }, [router])

  useEffect(() => {
    const authCode = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      setStatus('error')
      setMessage(errorDescription || `Authorization failed: ${error}`)
      return
    }

    if (!authCode) {
      setStatus('error')
      setMessage('No authorization code received from HubSpot')
      return
    }

    // Get user data from localStorage
    const eazybeResponseStr = localStorage.getItem('eazybe_verify_otp_response')
    if (!eazybeResponseStr) {
      setStatus('error')
      setMessage('User session not found. Please login first.')
      return
    }

    let eazybeData
    try {
      eazybeData = JSON.parse(eazybeResponseStr)
    } catch (e) {
      setStatus('error')
      setMessage('Invalid user session data')
      return
    }

    // Extract required fields
    const name = eazybeData?.data?.user_info?.email || ''
    const workspaceId = String(eazybeData?.data?.user_info?.id || '')
    const orgId = String(eazybeData?.data?.user_mapping?.org_id || '')

    if (!name || !workspaceId || !orgId) {
      setStatus('error')
      setMessage('Missing user data. Please login again.')
      return
    }

    // Automatically exchange token
    exchangeToken(authCode, name, workspaceId, orgId)
  }, [searchParams, exchangeToken])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connecting to HubSpot...</h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === 'exchanging' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Exchanging Token...</h2>
            <p className="text-gray-600 dark:text-gray-400">Please wait…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Success!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connection Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default OAuthCallback

