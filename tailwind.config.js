/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm neutral palette — mirrors voice-prompt's surface scale
        surface: {
          50:  '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },
        // Port badge accent — cool blue-green to make port numbers pop
        port: {
          light: '#A7C4BC',
          DEFAULT: '#6FA3A0',
          dark: '#4A7F7C',
        },
        // Process status colours
        status: {
          healthy:     '#7C9A82',  // sage green
          high_cpu:    '#C9A962',  // warm amber
          high_memory: '#C9A962',  // warm amber
          crashed:     '#B87A7A',  // dusty rose
        },
        // Docker badge
        docker: {
          light: '#93B4D4',
          DEFAULT: '#6B99BF',
          dark:  '#4D7AA3',
        },
      },
      fontFamily: {
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Compact sizes for dense menu bar UI
        '2xs': ['10px', { lineHeight: '14px' }],
        'xs':  ['11px', { lineHeight: '16px' }],
        'sm':  ['12px', { lineHeight: '18px' }],
        'base':['13px', { lineHeight: '20px' }],
      },
      transitionDuration: {
        '100': '100ms',
      },
      width: {
        'popup': '360px',
      },
      maxHeight: {
        'popup': '500px',
      },
      animation: {
        'spin-slow':       'spin 2s linear infinite',
        'pulse-subtle':    'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':         'fade-in 0.15s ease-out',
        'slide-down':      'slide-down 0.15s ease-out',
        'detail-expand':   'detail-expand 0.2s ease-out',
        'process-enter':   'process-enter 0.15s ease-out',
        'process-exit':    'process-exit 0.1s ease-in',
        'copy-confirm':    'copy-confirm 0.2s ease-out',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.6' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'detail-expand': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'process-enter': {
          from: { opacity: '0', transform: 'translateY(-2px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'process-exit': {
          from: { opacity: '1' },
          to:   { opacity: '0' },
        },
        'copy-confirm': {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'popup':   '0 8px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        'soft-sm': '0 1px 2px rgba(28, 25, 23, 0.04)',
        'soft-md': '0 4px 6px -1px rgba(28, 25, 23, 0.06), 0 2px 4px -1px rgba(28, 25, 23, 0.04)',
        'soft-lg': '0 10px 15px -3px rgba(28, 25, 23, 0.06), 0 4px 6px -2px rgba(28, 25, 23, 0.03)',
      },
    },
  },
  plugins: [],
};
