import formsPlugin from 'windicss/plugin/forms'
import colors from 'windicss/colors'

module.exports = {
  extract: {
    include: ['./**/*.html','./**/*.vue','./**/*.css'],
  },
  darkMode:'class',
  theme: {
	  colors: {
			...colors,
		  near1: {
				100: '#bbdde3',
				200: '#a0dce7',
				300: '#8bd7e5',
				400: '#6AD1E3FF',
				500: '#4fcae0',
				600: '#33c3dc',
				700: '#24c5e1',
				800: '#10c4e3',
				900: '#02c6e8',
		  }
	  },
    extend: {
      container: {
        center: true
      }
    }
  },
  variants: {
    extend: {}
  },
  plugins: [formsPlugin]
}
