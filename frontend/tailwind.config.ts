import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        progress: "progress-indeterminate 2s ease-in-out infinite",
      },
      keyframes: {
        "progress-indeterminate": {
          "0%": { width: "0%", marginLeft: "0%" },
          "50%": { width: "70%", marginLeft: "15%" },
          "100%": { width: "0%", marginLeft: "100%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
