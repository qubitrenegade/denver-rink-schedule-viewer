# ESLint Migration Plan

As TSLint has been deprecated since 2019, this document outlines the recommended migration path to ESLint.

## Why Migrate?
- TSLint is no longer maintained
- ESLint has better TypeScript support via @typescript-eslint
- Larger ecosystem of plugins and rules
- Better performance

## Migration Steps

1. Install ESLint and TypeScript parser:
```bash
bun add -d eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

2. Create a basic `.eslintrc.js` configuration:
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // Add custom rules here
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

3. Update your `package.json` scripts:
```json
"scripts": {
  "lint": "eslint 'src/**/*.{ts,tsx}'",
  "lint:fix": "eslint 'src/**/*.{ts,tsx}' --fix"
}
```

4. Update the GitHub workflow to use ESLint instead of TSLint.

5. Remove TSLint after confirming ESLint is working correctly:
```bash
bun remove tslint
```

## Equivalent Rules

Many TSLint rules have direct equivalents in ESLint. The TSLint team created a migration guide and tools to help: https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/ROADMAP.md

## Timeline

Consider implementing this migration in the next development cycle to ensure better long-term maintainability of the codebase.
