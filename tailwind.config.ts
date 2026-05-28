import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        ink: "var(--ink)",
        "ink-dim": "var(--ink-dim)",
        "ink-faint": "var(--ink-faint)",
        brand: "#ff2b2b",
        ready: "#3ddc84",
        working: "#ffc02e",
        diag: "#ff3b46",
        rent: "#3aa0ff",
        pif: "#ff8a3d",
        downpmt: "#ffb86b",
        govt: "#b07cff",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: { card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -16px rgba(0,0,0,0.8)" },
      borderRadius: { card: "6px" },
    },
  },
  plugins: [],
};
export default config;
