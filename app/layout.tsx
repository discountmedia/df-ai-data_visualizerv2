import type { Metadata } from "next";
import { IBM_Plex_Mono, Anton } from "next/font/google";
import { DashboardProvider } from "@/components/DashboardProvider";
import { ProBridge } from "@/components/ProBridge";
import "./globals.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

// Heavy condensed display face — big stat numerals ONLY (per the design system).
const display = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Discount Forklift — Inventory Intelligence",
  description: "Operational dashboard for messy forklift inventory exports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${mono.variable} ${display.variable}`}>
      <body>
        <ProBridge />
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
