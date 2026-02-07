module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    "no-unused-vars": "warn",
    "quotes": ["error", "single", { "avoidEscape": true }],
    "semi": ["error", "always"],
    "indent": ["error", 4],
    "max-len": ["warn", { "code": 120 }],
  },
};
