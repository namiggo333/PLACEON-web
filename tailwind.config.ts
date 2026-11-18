import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF6B00",
          dark: "#F05F00",
          deep: "#C74B00",
          light: "#FFF7F2",
          soft: "#FFE9D6",
          glow: "#FF8A2B",
        },
        ink: {
          DEFAULT: "#14192D",
          soft: "#4A5169",
          mute: "#8A90A3",
          line: "#EDEFF4",
        },
        cream: "#FFF7F2",
        peach: "#FFE9D6",
      },
      boxShadow: {
        card: "0 2px 10px rgba(20, 25, 45, 0.06)",
        pop: "0 16px 40px rgba(255, 107, 0, 0.18)",
        float: "0 10px 30px rgba(20, 25, 45, 0.10)",
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
