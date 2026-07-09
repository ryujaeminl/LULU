import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "LuLu - 루게릭 환자 소통 및 스마트 돌봄 플랫폼",
  description: "AI-Powered ALS Communication & Care System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* MediaPipe is loaded dynamically inside MediaPipeEngine.ts via ES module import.
            No <Script> tag needed here. */}
        {children}
      </body>
    </html>
  );
}
