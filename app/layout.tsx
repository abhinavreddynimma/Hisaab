import type { Metadata } from "next"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "sonner"
import { getAuthContext } from "@/lib/auth"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Hisaab",
  description: "Freelancer Payroll Management",
}

export const dynamic = "force-dynamic"

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authState = await getAuthContext()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jakarta.variable} font-sans`}>
        <ThemeProvider>
          <AppShell authState={authState}>{children}</AppShell>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
