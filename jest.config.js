// jest.config.js
module.exports = {
  preset: 'ts-jest', // Use ts-jest preset
  testEnvironment: 'node',
  collectCoverage: true, // Enable coverage collection
  coverageReporters: ["json", "lcov", "text", "clover", "html"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [ // Specify files for coverage
    "src/**/*.ts", // Change from .js to .ts
    "!src/server.ts",
    "!src/config/**", // Configs are hard to test meaningfully for coverage in isolation
    "!src/adapters/mongoUserAdapter.ts", // Exclude stubs or specific adapters if not fully tested
    "!src/adapters/postgresUserAdapter.ts",
    "!src/adapters/userStoreAdapter.ts", // Abstract class
    "!**/node_modules/**",
    "!src/types/**" // Exclude type definition files
  ],
  setupFilesAfterEnv: ["./tests/setup.ts"], // Point to setup.ts (will be renamed)
  moduleNameMapper: { // If using path aliases in tsconfig.json, map them for Jest
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
};
