import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Uses only the lint packages that are actually listed in package.json, so
// `npm run lint` works right after `npm install` (the previous config imported
// eslint-plugin-prettier, eslint-plugin-react-hooks and eslint-plugin-react-refresh,
// none of which were installed).
export default tseslint.config(
  { ignores: ["dist", ".output", ".wrangler", ".nitro", ".vinxi", ".tanstack", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
