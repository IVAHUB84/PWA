import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['docs/modules/**/*.js', 'docs/app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        Notification: 'readonly',
        FileReader: 'readonly',
        emailjs: 'readonly',
        self: 'readonly',
        clients: 'readonly',
        caches: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
    },
  },
];
