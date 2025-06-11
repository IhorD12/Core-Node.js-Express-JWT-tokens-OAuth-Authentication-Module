// .eslintrc.js
module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
    jest: true, // Add jest environment for test files
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'prettier/prettier': 'error', // Report Prettier violations as ESLint errors
    // Add any custom ESLint rules here if needed
    // e.g., 'no-console': 'warn', // Example: warn about console.log
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', 'docs/', 'scripts/setup.js'], // Ignore build, coverage, docs, and setup script
};
