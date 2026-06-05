import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import { DashboardProvider } from "@/components/DashboardProvider";
import { ProBridge } from "@/components/ProBridge";
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
      <body>
        <ProBridge />
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
