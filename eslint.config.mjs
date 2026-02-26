import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["out/", "dist/", "node_modules/", "esbuild.mjs"],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
