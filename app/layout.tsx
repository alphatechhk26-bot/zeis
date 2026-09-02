import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Manrope } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: "ZEIS — Zanzibar Education Intelligence System",
  description:
    "A unified, AI-powered platform for managing schools across Zanzibar — students, teachers, attendance, exams, and finance in one place.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1621",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} ${manrope.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <Suspense fallback={null}>{children}</Suspense>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
