/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Brand tokens ─────────────────────────────────────────────── */
        brand: {
          DEFAULT: "#008080",          /* Darker brand color #008080 */
          dark:    "#122224",          /* Darker brand dark #122224 */
          bright:  "#00a8a8",          /* Brighter brand color #00a8a8 */
          light:   "#e0f4f4",          /* Light brand tint */
        },
        accent: {
          DEFAULT: "#00a8a8",          /* Brighter brand color #00a8a8 */
          hover:   "#008080",
        },
        dark:      "#181818",          /* Dark mode background #181818 */
        surface:   "#282828",          /* Dark mode surface / input #282828 */
        midGray:   "#a0a0a8",

        /* ── shadcn-compatible semantic tokens ─────────────────────────── */
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "#008080",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "#008080",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
