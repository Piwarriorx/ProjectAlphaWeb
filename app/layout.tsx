import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EzCrosshairX — Login',
  description: 'Simple Gaming Tool',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0c15', color: '#fff' }}>
        {children}
      </body>
    </html>
  )
}