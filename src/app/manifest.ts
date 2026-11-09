import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutriPet',
    short_name: 'NutriPet',
    description: 'Tu compañero de nutrición y actividad',
    lang: 'es-CO',
    start_url: '/inicio',
    display: 'standalone',
    background_color: '#fffdf8',
    theme_color: '#fffdf8',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
