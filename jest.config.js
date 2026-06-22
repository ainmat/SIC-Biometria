export default {
  testEnvironment: 'node',

  setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],

  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
  ],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  clearMocks: true,
  restoreMocks: true,
  verbose: true,
};
