// Setup global mocks (CommonJS para compatibilidade com ESM + jest)

const localStorageMock = {
  _store: {},
  getItem(key) { return this._store[key] ?? null; },
  setItem(key, value) { this._store[key] = String(value); },
  removeItem(key) { delete this._store[key]; },
  clear() { this._store = {}; },
  get length() { return Object.keys(this._store).length; },
  key(i) { return Object.keys(this._store)[i] ?? null; },
};

global.localStorage = localStorageMock;

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
}));

global.fetch = jest.fn();
