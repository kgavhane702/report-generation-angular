// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    linterOptions: {
      // This repo already contains a number of eslint-disable comments from earlier iterations.
      // Don't block adoption on "unused disable" cleanup.
      reportUnusedDisableDirectives: "off",
    },
    processor: angular.processInlineTemplates,
    rules: {
      // This codebase currently uses `any` heavily (especially in widget props and adapters).
      // Keep lint actionable by not failing the build on pre-existing typing gaps.
      "@typescript-eslint/no-explicit-any": "off",

      // Stylistic rules that are noisy to adopt all-at-once.
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/prefer-for-of": "off",
      "@typescript-eslint/no-inferrable-types": "off",

      // Prefer TypeScript compiler + IDE for unused tracking; avoid mass churn.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/class-literal-property-style": "off",
      "@typescript-eslint/consistent-type-definitions": "off",

      // Keep this off for now; it's helpful but creates huge churn in reducers/components.
      "prefer-const": "off",

      // Angular 16 codebase: keep this flexible (some lifecycle hooks are intentionally present for future use).
      "@angular-eslint/no-empty-lifecycle-method": "off",
      "@angular-eslint/prefer-inject": "off",
      "@angular-eslint/no-output-native": "off",

      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          // This repo already uses both `app` (components) and `tw` (table widget utilities).
          prefix: ["app", "tw"],
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
    ],
    rules: {
      // Angular 16: control flow (`@if`, `@for`) is Angular 17+. Disable until the app upgrades.
      "@angular-eslint/template/prefer-control-flow": "off",

      // Accessibility rules are valuable but are currently too noisy to enable wholesale.
      // Re-enable incrementally once lint is adopted in CI.
      "@angular-eslint/template/click-events-have-key-events": "off",
      "@angular-eslint/template/interactive-supports-focus": "off",
      "@angular-eslint/template/role-has-required-aria": "off",

      // Style-only rule; keep lint focused on correctness.
      "@angular-eslint/template/no-negated-async": "off",
    },
  }
]);
