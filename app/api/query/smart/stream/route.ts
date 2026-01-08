import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, uid, conversation_id, apiUrl } = body

    if (!apiUrl) {
      return new Response(JSON.stringify({ error: 'API URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Server-side HTTP call - stream the response
    const response = await fetch(`${apiUrl}/query/smart/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward ngrok headers if needed
        ...(apiUrl.includes('ngrok') && { 'ngrok-skip-browser-warning': 'true' }),
      },
      body: JSON.stringify({
        query,
        uid,
        conversation_id,
      }),
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to stream: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Stream the response back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error streaming query:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

