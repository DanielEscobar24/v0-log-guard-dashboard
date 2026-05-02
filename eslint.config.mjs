import nextVitals from "eslint-config-next/core-web-vitals"

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "tsconfig.tsbuildinfo",
      "next-env.d.ts",
      "services/**/__pycache__/**",
      "**/*.pyc",
    ],
    rules: {
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

export default eslintConfig
