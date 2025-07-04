import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import templateParser from '@angular-eslint/template-parser';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default [
  {
    // Global ignores
    ignores: ['projects/**/*', 'dist/'],
  },
  {
    // Apply to TypeScript files
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      '@angular-eslint': angular,
      prettier,
      'unused-imports': unusedImports,
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }], // Flag console.log
      'no-debugger': 'error',
      'prettier/prettier': 'error', // Enforce Prettier
      'no-unused-vars': 'off',
      // '@typescript-eslint/no-unused-vars': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@angular-eslint/no-empty-lifecycle-method': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      // '@typescript-eslint/no-non-null-assertion': 'warn', // Warn instead of error for flexibility
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // Prefer interfaces
      '@typescript-eslint/no-unused-expressions': 'error',
    },
  },
  {
    // Apply to Angular templates
    files: ['**/*.component.html'],
    languageOptions: {
      parser: templateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplate,
      prettier,
    },
    rules: {
      '@angular-eslint/template/no-negated-async': 'error',
      'prettier/prettier': ['error', { parser: 'angular' }],
    },
  },
];
