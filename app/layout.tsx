import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import { DashboardProvider } from "@/components/DashboardProvider";
import { PRO_BRIDGE_SCRIPT } from "@/lib/proBridgeScript";
import "./globals.css";

// Clean, modern, highly legible UI font (replaces the terminal monospace).
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Heavy display face for big stat numerals only.
const display = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Discount Forklift — Inventory Intelligence",
  description: "Operational dashboard for messy forklift inventory exports.",
  // favicon.ico lives in /public; the ?v= busts the browser's aggressive
  // favicon cache after the file is updated.
  icons: { icon: "/favicon.ico?v=2" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* PRO (FileMaker) bridge — installed pre-hydration so the global
            functions FileMaker calls by name exist from initial page parse. */}
        <script dangerouslySetInnerHTML={{ __html: PRO_BRIDGE_SCRIPT }} />
      </head>
      <body>
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
