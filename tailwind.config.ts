import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			titulo: ['var(--fuente-titulo)', 'sans-serif'],
  			cuerpo: ['var(--fuente-cuerpo)', 'sans-serif'],
  		},
  		fontSize: {
  			'k-turno': ['220px', { lineHeight: '1', fontWeight: '700' }],
  			'k-pregunta': ['56px', { lineHeight: '1.2', fontWeight: '600' }],
  			'k-titulo': ['36px', { lineHeight: '1.3', fontWeight: '600' }],
  			'k-sub': ['24px', { lineHeight: '1.5', fontWeight: '400' }],
  			'k-tecla': ['48px', { lineHeight: '1', fontWeight: '600' }],
  		},
  		spacing: {
  			'k-gap': '24px',
  			'k-tarjeta': '440px',
  			'k-tarjeta-alto': '340px',
  		},
  		colors: {
  			gris: {
  				20: 'var(--gris-20)',
  				70: 'var(--gris-70)',
  				80: 'var(--gris-80)',
  				principal: 'var(--gris-principal)',
  			},
  			gainsboro: 'var(--gainsboro)',
  			osp: 'var(--osp)',
  			panel: {
  				fondo: 'var(--panel-fondo)',
  				superficie: 'var(--panel-superficie)',
  				borde: 'var(--panel-borde)',
  				texto: 'var(--panel-texto)',
  				'texto-suave': 'var(--panel-texto-suave)',
  				primario: 'var(--panel-primario)',
  				'primario-fuerte': 'var(--panel-primario-fuerte)',
  				'primario-suave': 'var(--panel-primario-suave)',
  				exito: 'var(--panel-exito)',
  				nav: 'var(--panel-nav)',
  				'nav-suave': 'var(--panel-nav-suave)',
  				'nav-texto': 'var(--panel-nav-texto)',
  				'nav-activo': 'var(--panel-nav-activo)',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
