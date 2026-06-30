import nextConfig from 'eslint-config-next/core-web-vitals';
import tsConfig from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const config = [
  { ignores: ['scripts/**', '.next/**', 'node_modules/**'] },
  ...nextConfig,
  ...tsConfig,
  {
    settings: {
      react: { version: '19' },
    },
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/incompatible-library': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettierConfig,
];

export default config;
