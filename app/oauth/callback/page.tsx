'use client'

import { Suspense } from 'react'
import OAuthCallback from '@/src/components/OAuthCallback'

export const dynamic = 'force-dynamic'

export default function OAuthCallbackAliasPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-800" />}>
      <OAuthCallback />
    </Suspense>
  )
}

