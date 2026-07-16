import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import { DashboardProvider } from "@/components/DashboardProvider";
import { PRO_BRIDGE_SCRIPT } from "@/lib/proBridgeScript";
import { Analytics } from "@vercel/analytics/next";
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

// Deterrent (production only) — suppress the right-click menu, DevTools
// shortcuts (F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U), and KEYBOARD refresh
// (F5, Ctrl/Cmd+R, Ctrl+Shift+R) so operators in the Web Viewer can't casually
// reload or inspect. This is NOT real protection: native reload buttons/gestures
// cannot be blocked from page JS — the authoritative control is disabling DevTools
// + browser accelerator keys on the FileMaker Web Viewer (WebView2). Prod-only so
// local dev keeps its tools + refresh.
const HARDEN_SCRIPT = `(function(){try{
  document.addEventListener("contextmenu",function(e){e.preventDefault();},true);
  document.addEventListener("keydown",function(e){
    var k=(e.key||"").toLowerCase();
    if(e.key==="F12"||e.key==="F5"||((e.ctrlKey||e.metaKey)&&e.shiftKey&&(k==="i"||k==="j"||k==="c"))||((e.ctrlKey||e.metaKey)&&(k==="u"||k==="r"))){
      e.preventDefault();e.stopPropagation();
    }
  },true);
}catch(_){}})();`;

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
        {/* Deterrent: block right-click / DevTools shortcuts in production only. */}
        {process.env.NODE_ENV === "production" && (
          <script dangerouslySetInnerHTML={{ __html: HARDEN_SCRIPT }} />
        )}
      </head>
      <body>
        <DashboardProvider>{children}</DashboardProvider>
        <Analytics />
      </body>
    </html>
  );
}
