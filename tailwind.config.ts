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

        // ---------------------------------------------------------------
        // Tokens semânticos (CRM) — definidos em globals.css.
        // Convivem com as escalas acima: `bg-primary-500` (paleta fixa) e
        // `bg-primary` (token, acompanha o tema) valem os dois.
        // ---------------------------------------------------------------
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        surface: {
          soft: 'hsl(var(--surface-soft))',
          raised: 'hsl(var(--surface-raised))',
          strong: 'hsl(var(--surface-strong))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          strong: 'hsl(var(--success-strong))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          strong: 'hsl(var(--warning-strong))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          strong: 'hsl(var(--info-strong))',
          foreground: 'hsl(var(--info-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      // Escala tipográfica do CRM. Nomes próprios de propósito: redefinir
      // `sm`/`md`/`lg` mudaria o tamanho de texto, o raio e a sombra das 19
      // telas antigas, que não estão no escopo desta migração.
      fontSize: {
        caption: ['0.6875rem', { lineHeight: '1rem' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        'body-lg': ['0.9375rem', { lineHeight: '1.375rem' }],
        'section-title': ['1rem', { lineHeight: '1.5rem' }],
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
