import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Paleta primária: DOURADO (substituiu o azul ciano).
        // Tom premium pra identidade da marca meuloteamento — combina
        // com fundo preto + branco. Funciona em light e dark mode.
        primary: {
          50:  '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',  // dourado clássico
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        // Dourado metálico — para destaques nobres (logo, headlines, CTA)
        gold: {
          50:  '#fffaeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#e6c244',
          500: '#d4af37',  // ouro polido
          600: '#b8941d',
          700: '#9a7b15',
          800: '#7c6112',
          900: '#5f4a0e',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
