import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MindMap Portugal - Explorando a Saúde Mental',
  description: 'Uma experiência interativa sobre o cenário da saúde mental em Portugal',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#050508" />
      </head>
      <body className={`${inter.variable} ${lora.variable}`}>
        {/* Skip to content link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-neural-accent focus:text-deep-black focus:font-semibold focus:rounded"
        >
          Ir para conteúdo principal
        </a>
        {children}
      </body>
    </html>
  )
}
