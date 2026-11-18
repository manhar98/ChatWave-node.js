
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8B5CF6",
          dark: "#7C3AED",
          light: "#A78BFA",
        },
        darkBg: "#09090F",
        darkCard: "#181824",
      },
    },
  },
  plugins: [],
};
