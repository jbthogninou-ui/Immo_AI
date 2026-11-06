/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Vert lagune — la couleur structurante de la marque
        lagoon: {
          50: '#EDF5F3', 100: '#D3E7E2', 200: '#A6CFC6', 300: '#6FB0A3',
          400: '#3D8E7F', 500: '#157A6E', 600: '#0E4D45', 700: '#0B3B36',
          800: '#08302B', 900: '#051F1C',
        },
        // Laiton — accent premium, hérité du travail du bronze béninois
        brass: {
          50: '#FBF6EC', 100: '#F5E9CF', 200: '#EBD5A6', 300: '#E3C58A',
          400: '#D6AC5F', 500: '#C8963E', 600: '#A87A2C', 700: '#835D20',
          800: '#5C4116', 900: '#3A290E',
        },
        // Latérite — signal chaud, utilisé avec parcimonie
        laterite: { 400: '#D97A5B', 500: '#C25C3C', 600: '#A0462A' },
        ink: '#101F1C',
        sand: '#FAF7F2',
        // Surfaces pilotées par variables CSS (bascule clair/sombre)
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        content: 'rgb(var(--content) / <alpha-value>)',
        'content-muted': 'rgb(var(--content-muted) / <alpha-value>)',
        'content-subtle': 'rgb(var(--content-subtle) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
        display: ['clamp(2.75rem, 6vw, 5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        hero: ['clamp(3.25rem, 8vw, 6.5rem)', { lineHeight: '0.94', letterSpacing: '-0.035em' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: '0 1px 2px rgb(8 48 43 / 0.04), 0 8px 24px -12px rgb(8 48 43 / 0.16)',
        lift: '0 2px 4px rgb(8 48 43 / 0.05), 0 24px 48px -20px rgb(8 48 43 / 0.28)',
        brass: '0 8px 32px -12px rgb(200 150 62 / 0.55)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        'draw-line': { '0%': { strokeDashoffset: '1000' }, '100%': { strokeDashoffset: '0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        'draw-line': 'draw-line 2.5s ease-out forwards',
      },
      transitionTimingFunction: { swift: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
}
