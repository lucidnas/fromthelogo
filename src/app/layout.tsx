import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { isAuthenticated } from "@/lib/auth";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "From The Logo — Content Studio",
  description: "Video ideas, scripts, and content for the From The Logo YouTube channel.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthenticated();

  return (
    <html lang="en" className={`${outfit.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        {authed && (
          <nav className="sticky top-0 z-50 bg-[#0b0b0f]/80 backdrop-blur-xl border-b border-[#22222b]">
            <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">FTL</div>
                <span className="font-semibold text-white text-lg tracking-tight">From The Logo</span>
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors">Analytics</Link>
                <Link href="/thumbnails" className="text-sm text-gray-400 hover:text-white transition-colors">Thumbnails</Link>
                <Link href="/calendar" className="text-sm text-gray-400 hover:text-white transition-colors">Calendar</Link>
                <Link href="/pitches" className="text-sm text-gray-400 hover:text-white transition-colors">Daily Pitches</Link>
                <Link href="/news" className="text-sm text-gray-400 hover:text-white transition-colors">News</Link>
                <Link href="/scripts" className="text-sm text-gray-400 hover:text-white transition-colors">Scripts</Link>
                <LogoutButton />
              </div>
            </div>
          </nav>
        )}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
