import './globals.css'
import { AuthGate } from '../lib/AuthGate'

export const metadata = {
  title: 'Project Plan Agent',
  description: 'Multifunction event project plan + seating'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  )
}
