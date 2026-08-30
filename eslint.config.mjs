import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'backend/target/**', 'graphify-out/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { document: 'readonly', window: 'readonly', navigator: 'readonly', location: 'readonly', sessionStorage: 'readonly', requestAnimationFrame: 'readonly', fetch: 'readonly', URL: 'readonly', FormData: 'readonly', Element: 'readonly', HTMLAnchorElement: 'readonly', HTMLMetaElement: 'readonly', HTMLLinkElement: 'readonly', HTMLHeadingElement: 'readonly', HTMLButtonElement: 'readonly', HTMLInputElement: 'readonly', HTMLFormElement: 'readonly', HTMLSelectElement: 'readonly', SubmitEvent: 'readonly', RequestInit: 'readonly', Intl: 'readonly', console: 'readonly', process: 'readonly', Buffer: 'readonly', setTimeout: 'readonly' } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' }
  }
);
