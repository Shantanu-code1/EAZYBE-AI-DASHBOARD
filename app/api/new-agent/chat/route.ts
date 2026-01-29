import { NextRequest, NextResponse } from 'next/server'

const NEW_AGENT_BASE_URL = 'http://jwcscw0g84o8c4k84w4s0oss.5.161.117.36.sslip.io/api/v1/chat'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { query, org_id, workspace_id, stream = true } = body

    if (!query || org_id == null || org_id === '' || workspace_id == null || workspace_id === '') {
      return NextResponse.json(
        { error: 'Missing required fields: query, org_id, workspace_id' },
        { status: 400 }
      )
    }

    const payload = {
      query: String(query).trim(),
      org_id: String(org_id),
      workspace_id: String(workspace_id),
      stream: Boolean(stream),
    }

    const response = await fetch(NEW_AGENT_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `Chat request failed: ${response.status} ${response.statusText}`, details: errorData },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || ''

    // Stream response back to client
    if (payload.stream && response.body) {
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType || 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error calling new-agent chat:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call chat API' },
      { status: 500 }
    )
  }
}
