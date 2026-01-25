import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { code, redirect_uri, name, workspace_id, org_id } = body

    // Get apiUrl from query params or default
    const searchParams = request.nextUrl.searchParams
    const apiUrl = searchParams.get('apiUrl') || 'http://localhost:8000'

    if (!code || !redirect_uri || !name || !workspace_id || !org_id) {
      return NextResponse.json(
        { error: 'Missing required fields: code, redirect_uri, name, workspace_id, org_id' },
        { status: 400 }
      )
    }

    // Server-side HTTP call - no mixed-content issues
    const response = await fetch(`${apiUrl}/hubspot/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri,
        name,
        workspace_id,
        org_id,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `Token exchange failed: ${response.status} ${response.statusText}`, details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error exchanging HubSpot token:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange token' },
      { status: 500 }
    )
  }
}
