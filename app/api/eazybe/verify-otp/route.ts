import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim()
    const source = String(body.source || 'gmail').trim() || 'gmail'

    if (!email) {
      return NextResponse.json({ status: false, error: 'email is required' }, { status: 400 })
    }

    const url = `https://api.eazybe.com/v2/workspace/verify-otp?email=${encodeURIComponent(email)}&source=${encodeURIComponent(source)}`

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        // mimic browser headers (server-to-server, so allowed)
        Origin: 'https://app.eazybe.com',
        Referer: 'https://app.eazybe.com/',
      },
    })

    const contentType = upstream.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const payload = isJson ? await upstream.json() : await upstream.text()

    if (!upstream.ok) {
      return NextResponse.json(
        { status: false, error: 'verify-otp failed', upstream_status: upstream.status, payload },
        { status: 502 }
      )
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { status: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

