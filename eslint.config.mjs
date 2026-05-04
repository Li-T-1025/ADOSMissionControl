import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "convex/_generated/**",
      "convex-tutorial/**",
      "release/**",
    ],
  },
];

export default eslintConfig;
