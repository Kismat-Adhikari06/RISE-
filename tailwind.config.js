/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: { sans: ['"Inter Variable"', 'system-ui', 'sans-serif'] },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(0,0,0,0.7)',
        glow: '0 0 40px -6px rgb(var(--accent) / 0.45)',
      },
    },
  },
  plugins: [],
};
