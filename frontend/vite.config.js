import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import WindiCSS from 'vite-plugin-windicss'
// import polyfillNode from 'rollup-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
	  // polyfillNode(), // Not working....
    vue(),
    WindiCSS()
  ],
	optimizeDeps: {
		exclude: ['node-sdk-js'] // <= The libraries that need shimming should be excluded from dependency optimization.
	},
  server: {
    open: '/test',
  }
})
