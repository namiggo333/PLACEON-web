import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E31C79",
          dark: "#DA1884",
          deep: "#B01361",
          light: "#FDF2F8",
          soft: "#FCE7F3",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          soft: "#4B5563",
          mute: "#8B95A1",
          line: "#ECEEF2",
        },
      },
      boxShadow: {
        card: "0 2px 10px rgba(17, 24, 39, 0.06)",
        pop: "0 16px 40px rgba(227, 28, 121, 0.16)",
        float: "0 8px 30px rgba(17, 24, 39, 0.10)",
      },
      borderRadius: {
        xl2: "20px",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "Malgun Gothic",
          "system-ui",
          "sans-serif",
        ],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        "pop-in": "pop-in .2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
