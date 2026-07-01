/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F17',
        panel: '#111827',
        border: 'rgba(255,255,255,0.08)',
        text: '#E2E8F0',
        muted: '#8892A6',
        dim: '#4A5568',
        friendly: '#22D3EE',
        accent: '#22C55E',
        blue: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      fontSize: {
        '2xs': '0.8125rem',
        '3xs': '0.75rem',
      },
    },
  },
  plugins: [],
}
