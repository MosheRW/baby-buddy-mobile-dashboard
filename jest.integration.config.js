/**
 * Config for the live-server integration test (`npm run test:live`).
 *
 * Deliberately does NOT use the jest-expo preset: that preset installs Expo's
 * `FetchResponse` polyfill, whose objects don't expose `.status`/`.ok`, so every
 * request looks like a failure. Plain Node (18+) has a spec-compliant global
 * fetch, which is what we want when talking to a real server. The app itself
 * runs on React Native's fetch, which is also spec-compliant here.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
