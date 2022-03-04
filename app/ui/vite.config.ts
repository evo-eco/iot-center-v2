import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import envCompatible from 'vite-plugin-env-compatible'
import svgLoader from '@honkhonk/vite-plugin-svgr'

export default defineConfig({
  plugins: [react(), svgLoader(), envCompatible({prefix: 'REACT_APP'})],
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  resolve: {
    alias: {
      '~antd': require('path').resolve(__dirname, '..', 'node_modules', 'antd'),
    },
  },
  server: {
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
  },
})
