import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, uid, apiUrl } = body

    if (!apiUrl) {
      return NextResponse.json({ error: 'API URL is required' }, { status: 400 })
    }

    // Server-side HTTP call
    const response = await fetch(`${apiUrl}/query/smart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        uid,
      }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to query: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error querying:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to query' },
      { status: 500 }
    )
  }
}

