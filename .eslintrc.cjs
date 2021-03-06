module.exports = {
    parser: '@typescript-eslint/parser',
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
        exclude: 'node_modules/**'
    },
    rules: {
        '@typescript-eslint/prefer-namespace-keyword': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off'
    },
    env: {
        "browser": true
    }
};
