import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/components/providers'
import { DriftChat } from '@/components/DriftChat'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'E-Commerce Admin Dashboard',
  description: 'Developed by Romeo Mukulah - Full Stack Developer',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Toaster
          position='top-right'
          richColors
          closeButton
          expand={false}
          duration={4000}
          toastOptions={{
            classNames: {
              toast: 'rounded-xl shadow-lg border',
              title: 'font-medium',
            },
          }}
        />
        <DriftChat />
      </body>
    </html>
  )
}
