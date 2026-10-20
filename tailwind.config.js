/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0F766E',        // Primary teal
          dark: '#115E59',           // Primary dark / Deep clinical teal
          sidebar: '#115E59',        // Deep clinical teal sidebar
          'sidebar-hover': '#134E4A',// Darker sidebar hover
          'sidebar-active': '#0F766E',// Active navigation item background
          'sidebar-dark': '#0D4844', // Darker teal surface for bottom profile block
          light: '#E6F4F2',          // Soft teal tint for subtle badges/hover
          surface: '#FFFFFF',        // White surfaces, top bar, and cards
          bg: '#F1F5F7',             // Main background (Clinical Teal Pro neutral)
          text: '#172B4D',           // Primary text (deep slate-navy)
          muted: '#475569',          // Secondary text (slate-600 with enhanced contrast)
          border: '#D8E1E7',         // Borders with refined contrast
          success: '#15803D',        // Clinical green
          warning: '#D97706',        // Warning amber
          error: '#DC2626',          // Error red
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};
