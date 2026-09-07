import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        border: {
          DEFAULT: "var(--border)",
          bright:  "var(--border-bright)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          dim: "var(--accent-dim)",
          border: "var(--accent-border)",
        },
        muted: "var(--muted)",
        dim: "var(--dim)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        body: ["Space Grotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
