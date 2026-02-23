/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/tests/__mocks__/@actions/core.cjs',
    '^@actions/github$': '<rootDir>/tests/__mocks__/@actions/github.cjs',
    '^@actions/github/lib/utils$': '<rootDir>/tests/__mocks__/@actions/github.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2022',
      },
      module: { type: 'commonjs' },
    }],
  },
};
