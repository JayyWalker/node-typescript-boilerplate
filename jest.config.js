import base from './jest.config.base.js'

// export default {
//   displayName: 'Unit',
//   testEnvironment: 'node',
//   transform: {
//     "^.+\\.(t|j)sx?$": "@swc/jest",
//   },
//   moduleNameMapper: {
//     '^(\\.{1,2}/.*)\\.(m)?js$': '$1',
//   },
//   testRegex: 'src\\/.+test\\.ts$',
//   coverageDirectory: 'coverage',
//   collectCoverageFrom: [
//     'src/**/*.ts',
//     '!src/**/*.d.ts',
//   ],
//   injectGlobals: false,
// };

export default Object.assign(base, {
  displayName: 'Unit',
  testRegex: 'src\\/.+test\\.ts$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  injectGlobals: false,
})
