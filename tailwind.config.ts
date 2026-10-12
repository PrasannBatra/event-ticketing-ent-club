import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F2F3F5",
        ink: "#151515",
        muted: "#6B7076",
        line: "#E3E5E8",
        accent: { DEFAULT: "#F2B83D", dark: "#E3A62A", soft: "#FCEFD0" },
        ultra: { DEFAULT: "#8A5F00", dark: "#6B4900", soft: "#FCEFD0" },
        heart: "#E5231F",
        good: { DEFAULT: "#0B8A55", soft: "#DDF5E9" },
        bad: { DEFAULT: "#C62F3E", soft: "#FBE3E5" },
        warn: { DEFAULT: "#F5A524", soft: "#FFF1D6", ink: "#6B4200" },
      },
      fontFamily: {
        display: ['"Outfit Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Outfit Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
