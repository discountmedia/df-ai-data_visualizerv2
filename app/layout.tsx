import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { DashboardProvider } from "@/components/DashboardProvider";
import "./globals.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Discount Forklift — Inventory Intelligence",
  description: "Operational dashboard for messy forklift inventory exports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={mono.variable}>
      <body>
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
