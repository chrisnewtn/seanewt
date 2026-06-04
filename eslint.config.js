import globals from 'globals';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [...compat.extends('eslint:recommended'), {
  languageOptions: {
    globals: {
      ...globals.node,
    },
    ecmaVersion: 2024,
    sourceType: 'module',
  },
  rules: {
    eqeqeq: ['error', 'always'],
    indent: ['warn', 2],
    'keyword-spacing': ['warn'],
    'key-spacing': ['warn', {
      beforeColon: false,
      afterColon: true,
      mode: 'minimum',
    }],
    'linebreak-style': ['warn', 'unix'],
    'no-useless-rename': ['warn'],
    'object-shorthand': ['warn', 'always'],
    quotes: ['warn', 'single'],
    semi: ['warn', 'always'],
    'space-before-blocks': ['warn', 'always'],
    'space-infix-ops': ['warn'],
  },
}];
