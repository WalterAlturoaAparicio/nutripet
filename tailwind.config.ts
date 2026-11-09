import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Distinct semantic colors so intake, expenditure and target never look alike (spec §5).
        intake: { DEFAULT: '#0f9d76', soft: '#d6f3ea' },
        expenditure: { DEFAULT: '#e07a1f', soft: '#fbe7d4' },
        target: { DEFAULT: '#4f5bd5', soft: '#e1e4fa' },
        surface: { DEFAULT: '#fffdf8', raised: '#ffffff', sunken: '#f4f1ea' },
        ink: { DEFAULT: '#1f2328', muted: '#5b6169', faint: '#8a9098' },
      },
      borderRadius: { card: '1.25rem' },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
} satisfies Config;
