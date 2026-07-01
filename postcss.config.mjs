/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Compile modern color syntax to rgb/srgb for older Chrome, Firefox, and Edge.
    "@csstools/postcss-oklab-function": {},
    "@csstools/postcss-color-mix-function": {},
  },
};

export default config;
