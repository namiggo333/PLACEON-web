import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF2E7E",
          hot: "#F01D71",
          dark: "#E01867",
          deep: "#B80D54",
          light: "#FFF0F6",
          soft: "#FFE4EF",
          glow: "#FF5C9D",
        },
        ink: {
          DEFAULT: "#1B1624",
          deep: "#14192D",
          soft: "#4F4757",
          mute: "#8E8798",
          line: "#F2ECF1",
        },
        blush: "#FFD9E9",
        cream: "#FFF0F6",
        peach: "#FFE4EF",
      },
      boxShadow: {
        card: "0 2px 10px rgba(27, 22, 36, 0.06)",
        pop: "0 16px 40px rgba(255, 46, 126, 0.22)",
        float: "0 10px 30px rgba(184, 13, 84, 0.12)",
        glowy: "0 0 0 6px rgba(255, 46, 126, 0.10)",
      },
      borderRadius: {
        xl2: "20px",
        xl3: "28px",
      },
      fontFamily: {
        sans: [
          "NanumSquareRound",
          "Jua",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "Jua",
          "NanumSquareRound",
          "Apple SD Gothic Neo",
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
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        "pop-in": "pop-in .2s ease-out both",
        floaty: "floaty 4.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
