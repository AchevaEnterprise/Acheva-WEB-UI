import stylelint from 'stylelint';

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-prettier/recommended'],
  rules: {
    'rule-empty-line-before': ['always', { except: ['first-nested'] }],
  },
};
