import type {Config} from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: '#020506',
          card: '#071214',
          line: 'rgba(82,237,222,0.16)',
          glow: '#43F1DF'
        }
      }
    }
  },
  plugins: []
};
export default config;
