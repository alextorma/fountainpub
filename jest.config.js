module.exports = {
    testMatch: [
      '**/*.spec.ts',
    ],
    modulePathIgnorePatterns: [
      "<rootDir>/out/"
    ],
    verbose: true,
    reporters: [
      'default',
    ],
    preset: 'ts-jest',
    diffMaxFiles: 1,
    diffMaxLines: 25
  }
