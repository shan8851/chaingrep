import type { Config } from "tailwindcss";

export const config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        panel: "2px"
      },
      boxShadow: {
        panel: "none"
      },
      colors: {
        chrome: {
          50: "#e8e8e8",
          200: "#9a9a9a",
          300: "#787878",
          400: "#4a4a4a",
          500: "#262626",
          600: "#1c1c1c",
          700: "#141414",
          800: "#0c0c0c",
          900: "#080808"
        },
        signal: {
          cyan: "#6cf2ff",
          green: "#8cffac",
          orange: "#ffb86b",
          red: "#ff6b8a"
        }
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
