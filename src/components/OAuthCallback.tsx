'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, Save } from 'lucide-react'

function OAuthCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'form' | 'exchanging' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Processing OAuth callback...')
  const [name, setName] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

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

    setCode(authCode)
    setStatus('form')
    setMessage('Please provide a name and workspace ID for this token')
  }, [searchParams])

  const exchangeToken = async () => {
    if (!code || !name.trim() || !workspaceId.trim() || !orgId.trim()) {
      setApiError('Please fill in name, workspace ID, and org ID')
      return
    }

    setStatus('exchanging')
    setApiError(null)

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

      // Store tokens locally (optional; keep if you need it)
      localStorage.setItem('hubspot_access_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('hubspot_refresh_token', data.refresh_token)
      if (data.expires_in) {
        localStorage.setItem('hubspot_token_expires_at', String(Date.now() + data.expires_in * 1000))
      }

      setStatus('success')
      setMessage('Token received successfully!')

      setTimeout(() => router.push('/'), 2000)
    } catch (error) {
      setStatus('form')
      setApiError(error instanceof Error ? error.message : 'Failed to exchange authorization code')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await exchangeToken()
  }

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

        {status === 'form' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Authorization Code Received!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., user_token_1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Workspace ID</label>
                <input
                  type="text"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="e.g., workspace_123"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organization ID</label>
                <input
                  type="text"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="e.g., 902"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              {apiError && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Exchange Token
              </button>
            </form>
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

