/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode:'class',
  theme: {
    extend: {
      colors: {
        main: 'white',
        dmain: 'black',
        lightMain: '#edededff',
        dlightMain: '#222222ff',
        lightMain2: '#d2d2d2ff',
        dlightMain2: '#343434ff',
        slightLightMain: '#f2f2f2ff',
        dslightLightMain: '#131313ff',
        borderColor: '#b5b5b5ff',
        dborderColor: '#414141ff',
        fadeColor: '#dededeff',
        dfadeColor: '#171717ff',
        txt: 'black',
        dtxt: 'white',
        txt2:'#b1b1b1ff',
        dtxt2: '#a0a0a0ff',
        lightTxt: '#252525ff',
        dlightTxt: '#d0d0d0ff',
        accentMain: '#2daadd',
        darkAccentMain: '#00364bff',
        orangeMain: '#FEAC5E',
        pinkMain: '#C779D0',
        cyanMain: '#4BC0C8',
        dorangeMain: '#fc9b41ff',
        dpinkMain: '#d557e3ff',
        dcyanMain: '#3ed8e3ff',
        lightAccentMain: '#c1dce6ff',
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
        }
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(90deg, #fc9b41ff, #d557e3ff, #3ed8e3ff)',
        'dgradient-main': 'linear-gradient(90deg, #5b3f26ff, #492a4dff, #1f4043ff)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        gradient: 'gradient 8s ease infinite',
      },
	   boxShadow: {
        'custom-lg': '0 10px 25px rgba(0, 0, 0, 0.15)', // lighter or darker shadow
        'custom-dark-lg': '5px 5px 5px rgba(145, 145, 145, 0.19)', // for dark mode
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
