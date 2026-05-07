/** @type {import('prettier').Config} */
const config = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  // Sort Tailwind classes automatically
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './app/globals.css',
}

export default config
