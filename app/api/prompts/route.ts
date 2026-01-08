import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') || '100'
    const skip = searchParams.get('skip') || '0'
    const apiUrl = searchParams.get('apiUrl') || 'http://localhost:8000'

    // Server-side HTTP call - no mixed-content issues
    const response = await fetch(`${apiUrl}/system-prompts/prompts?limit=${limit}&skip=${skip}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Next.js fetch cache options
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch prompts: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching prompts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptName, description, apiUrl } = body

    if (!apiUrl) {
      return NextResponse.json({ error: 'API URL is required' }, { status: 400 })
    }

    // Server-side HTTP call
    const response = await fetch(`${apiUrl}/system-prompts/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt_name: promptName,
        description: description,
      }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to create prompt: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating prompt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create prompt' },
      { status: 500 }
    )
  }
}

