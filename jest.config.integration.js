import base from './jest.config.base.js'

export default Object.assign(base, {
  displayName: 'Integration',
  testRegex: 'tests\\/integration\\/.+spec\\.ts$',
})
