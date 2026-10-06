import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sev: {
          critical: "#b42318",
          high: "#c4320a",
          medium: "#b54708",
          low: "#475467",
        },
      },
    },
  },
  plugins: [],
};

export default config;
