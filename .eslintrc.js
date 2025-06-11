// .eslintrc.js
module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser', // Specify the TypeScript parser
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module', // Allow for the use of imports
    project: './tsconfig.json', // Optional: Link to tsconfig.json for type-aware linting
  },
  plugins: [
    '@typescript-eslint', // Add the TypeScript plugin
    'prettier', // Keep prettier plugin
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // Use recommended rules from @typescript-eslint/eslint-plugin
    // 'plugin:@typescript-eslint/recommended-requiring-type-checking', // Optional: for type-aware linting rules
    'plugin:prettier/recommended', // Make sure this is last
  ],
  rules: {
    'prettier/prettier': 'error',
    // Example: Allow unused vars if prefixed with underscore
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    // Add any custom ESLint/TypeScript rules here
    // e.g., 'no-console': 'warn',
  },
  settings: {
    'import/resolver': {
      typescript: {}, // Use eslint-import-resolver-typescript
    },
  },
  ignorePatterns: ["node_modules/", "dist/", "coverage/", "docs/", "scripts/", "*.js"], // Ignore JS files in root, setup scripts, etc.
};
