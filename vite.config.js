import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : fonctionne aussi bien sur GitHub Pages (sous-dossier /nom-du-repo/)
// que sur un domaine ou sous-domaine (ex : tune.famillegermany.fr).
export default defineConfig({
  plugins: [react()],
  base: './',
});
