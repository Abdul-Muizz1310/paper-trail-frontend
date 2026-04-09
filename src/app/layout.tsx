import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "paper-trail — live AI debate",
  description:
    "Enter a claim. Two AI agents argue it live with citations. A third judges. Every debate is a receipt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="relative flex min-h-full flex-col bg-background text-foreground bg-grid bg-scanlines">
        <Providers>
          <div className="relative z-10 flex min-h-screen flex-col pb-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
