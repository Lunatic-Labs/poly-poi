/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1F3F6A",
          jade: "#4DA890",
          sky: "#AACFE3",
          blush: "#F399A6",
          cream: "#FBFAF8",
        },
      },
    },
  },
  plugins: [],
};
