import base from './jest.config.base.js'

export default Object.assign(base, {
  displayName: 'E2E',
  testRegex: 'tests\\/e2e\\/.+e2e\\.ts$',
})
