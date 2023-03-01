export default class RedisCacheMock {
  set = () => Promise.resolve()
  get = () => Promise.resolve()
  delete = () => Promise.resolve()
}
