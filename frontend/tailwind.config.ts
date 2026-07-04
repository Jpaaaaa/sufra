import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Refined Neo-Tech Palette
        'cyber-aqua': '#2EE7C9',
        'charcoal-graphite': '#1A1F25',
        'cosmic-grey': '#242A31',
        'cloud-soft-white': '#F4F6FA',
        'graphite': '#4A5668',
        'pulse-violet': '#8C7CFF',
        // Legacy color names for backward compatibility (mapped to new colors)
        'electric-mint': '#2EE7C9', // Cyber Aqua
        'deep-space-black': '#1A1F25', // Charcoal Graphite
        'cloud-white': '#F4F6FA', // Cloud Soft White
        'olive-gold': '#2EE7C9', // Cyber Aqua
        'graphite-blue': '#4A5668', // Graphite
        'warm-linen': '#F4F6FA', // Cloud Soft White
        'obsidian': '#121212', // Keep for text
        'pearl-grey': '#F4F6FA', // Cloud Soft White
      },
      borderRadius: {
        'soft': '12px',
        'soft-lg': '12px',
        'soft-xl': '12px',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 1px 2px rgba(0, 0, 0, 0.08)',
      },
      backdropBlur: {
        'matte': '8px',
      },
    }
  },
  corePlugins: {
    preflight: true,
    // Disable transition utilities for POS performance
    transitionProperty: false,
    transitionDuration: false,
    transitionDelay: false,
    transitionTimingFunction: false,
    animation: false,
  }
};

export default config;


