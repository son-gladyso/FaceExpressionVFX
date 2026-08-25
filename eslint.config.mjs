import globals from 'globals';
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        FaceConfig: 'readonly',
        FaceHelpers: 'readonly',
        FaceAUDetector: 'readonly',
        FaceExpressionAnalyzer: 'readonly',
        FacePsychologyEngine: 'readonly',
        FaceDetector: 'readonly',
        FacePolicies: 'readonly',
        FaceI18n: 'readonly',
        FaceExport: 'readonly',
        FaceHistory: 'readonly',
        FaceMesh: 'readonly',
        Camera: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      semi: ['error', 'always'],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
