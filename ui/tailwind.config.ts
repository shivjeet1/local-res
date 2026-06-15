// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        black:       "#000000",
        surface: {
          1: "#0a0a0a",
          2: "#111111",
          3: "#1a1a1a",
        },
        border: {
          DEFAULT: "#222222",
          bright:  "#333333",
        },
        accent:  "#00ff88",
        muted:   "#888888",
        dim:     "#444444",
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
