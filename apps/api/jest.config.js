/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts",
    "!src/scripts/**/*.ts",
    "!src/routes/auth.ts",
    "!src/routes/analytics.ts",
    "!src/routes/suggest.ts",
    "!src/middleware/auth.ts",
    "!src/config/db.ts",
    "!src/**/*.d.ts",
  ],
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageDirectory: "coverage",
  verbose: true,
  testTimeout: 20000,
};
