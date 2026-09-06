const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Absolute paths: resolve the same way no matter which directory vite/postcss is run from.
  content: [
    path.resolve(__dirname, 'index.html'),
    path.resolve(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
