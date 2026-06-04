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
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--brand-strong) / <alpha-value>)",
        ready: "rgb(var(--ready) / <alpha-value>)",
        working: "rgb(var(--working) / <alpha-value>)",
        diag: "rgb(var(--diag) / <alpha-value>)",
        rent: "rgb(var(--rent) / <alpha-value>)",
        pif: "rgb(var(--pif) / <alpha-value>)",
        downpmt: "rgb(var(--downpmt) / <alpha-value>)",
        govt: "rgb(var(--govt) / <alpha-value>)",
      },
      fontFamily: {
        // Primary UI font — clean, modern, accessible (replaces the terminal mono).
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        // Big stat numerals only (heavy condensed display face).
        display: ["var(--font-display)", "Saira Condensed", "Oswald", "Inter", "sans-serif"],
      },
      boxShadow: { card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -16px rgba(0,0,0,0.8)" },
      borderRadius: { card: "6px" },
    },
  },
  plugins: [],
};
export default config;
