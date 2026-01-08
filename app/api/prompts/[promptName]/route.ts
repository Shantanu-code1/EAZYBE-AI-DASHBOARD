import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { promptName: string } }
) {
  try {
    const body = await request.json()
    const { description, apiUrl } = body
    const { promptName } = params

    if (!apiUrl) {
      return NextResponse.json({ error: 'API URL is required' }, { status: 400 })
    }

    // Server-side HTTP call
    const response = await fetch(`${apiUrl}/system-prompts/prompts/${promptName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: description,
      }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to update prompt: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating prompt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update prompt' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { promptName: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const apiUrl = searchParams.get('apiUrl') || 'http://localhost:8000'
    const { promptName } = params

    // Server-side HTTP call
    const response = await fetch(`${apiUrl}/system-prompts/prompts/${promptName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to delete prompt: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error deleting prompt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete prompt' },
      { status: 500 }
    )
  }
}

