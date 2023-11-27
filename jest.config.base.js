export default {
  testEnvironment: 'node',
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.(m)?js$': '$1',
  },
  testRegex: 'src\\/.+test\\.ts$',
  injectGlobals: false,
  testTimeout: 20000,
};
