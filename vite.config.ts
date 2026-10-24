import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],server:{allowedHosts:['terminal.local']},build:{manifest:true,target:'es2022',rollupOptions:{output:{manualChunks(id){if(id.includes('/node_modules/')&&id.includes('/three/'))return 'three';if(id.includes('/node_modules/')&&(/\/(react|react-dom|scheduler)(@|\/)/.test(id)))return 'react';}}}},test:{environment:'node',include:['src/tests/**/*.test.ts','src/tests/**/*.test.tsx']}});
