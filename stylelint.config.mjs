import stylelint from 'stylelint';

/** @type {import('stylelint').Config} */
export default {
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-prettier/recommended',
    'stylelint-config-tailwindcss',
  ],
  rules: {
    'rule-empty-line-before': ['always', { except: ['first-nested'] }],
    'selector-class-pattern': null,
    'at-rule-no-unknown': null,
    'at-rule-no-deprecated': null,
    'scss/dollar-variable-pattern': null,
    "no-empty-source": null,
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['ng-deep'],
      },
    ],
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['get'],
      },
    ],
  },
};
