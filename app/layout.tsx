import type { Metadata } from 'next'
import '../src/index.css'

export const metadata: Metadata = {
  title: 'AI Dashboard',
  description: 'AI Dashboard for Knowledge Base, HubSpot, BigQuery, and more',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

