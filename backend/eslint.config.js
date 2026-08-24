import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // Targets the property, not the global, so `process.on` in the
      // entrypoint still works while `process.env` anywhere is caught.
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read env through `config` from @/config/configs — never process.env.",
        },
        {
          object: "Bun",
          property: "env",
          message:
            "Read env through `config` from @/config/configs — never Bun.env.",
        },
      ],
    },
  },
  {
    // configs.ts is the one legitimate reader of the environment.
    files: ["src/config/configs.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  { ignores: ["node_modules/", "dist/", "prisma/migrations/"] },
);
