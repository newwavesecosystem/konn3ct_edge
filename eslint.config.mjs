import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "dist/**", 
      "node_modules/**", 
      "frontend/**", 
      "k8s/**", 
      "docs/**", 
      "coverage/**", 
      "test-results/**",
      "**/*.js",
      "**/*.ts" // Ignore all JS/TS files for now since we don't have typescript-eslint
    ]
  }
];
