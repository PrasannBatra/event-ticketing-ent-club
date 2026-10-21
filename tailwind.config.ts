import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#060A14",
        card: "#0E1524",
        strong: "#0B1F4A",
        navy: "#002060",
        edge: "#27437F",
        ink: "#EAF0FB",
        muted: "#9AA6BD",
        line: "#222C44",
        accent: { DEFAULT: "#C8102E", dark: "#A60D26", soft: "#2A0F18" },
        ultra: { DEFAULT: "#FF8A9A", dark: "#FFB0BB", soft: "#2A0F18" },
        heart: "#FF3B4E",
        good: { DEFAULT: "#0A7D4D", soft: "#0E2A20", fg: "#5EE0A0" },
        bad: { DEFAULT: "#D6334A", soft: "#34121A", fg: "#FF8A98" },
        warn: { DEFAULT: "#F5A524", soft: "#33260C", ink: "#3A2400", fg: "#FFCB6B" },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Georgia", "serif"],
        sans: ['"Outfit Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
