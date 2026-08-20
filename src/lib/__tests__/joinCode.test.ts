import { InvalidJoinError, JOIN_VERSION, encodeJoin, parseJoin } from '../joinCode';

describe('encodeJoin / parseJoin round-trip', () => {
  it('round-trips a token payload', () => {
    const payload = {
      kind: 'token',
      url: 'https://bb.example.com',
      token: 'tok-123',
      mode: 'babybuddy',
    } as const;
    expect(parseJoin(encodeJoin(payload))).toEqual(payload);
  });

  it('round-trips a credentials payload', () => {
    const payload = {
      kind: 'credentials',
      url: 'https://bb.example.com',
      username: 'grandma',
      password: 'p@ss word',
      mode: 'babybuddy',
    } as const;
    expect(parseJoin(encodeJoin(payload))).toEqual(payload);
  });

  it('preserves the Home Assistant mode', () => {
    const payload = {
      kind: 'token',
      url: 'https://ha.example.com/babybuddy',
      token: 't',
      mode: 'homeassistant',
    } as const;
    expect(parseJoin(encodeJoin(payload))).toEqual(payload);
  });

  it('defaults mode to babybuddy for a v1 code without a mode', () => {
    const raw = JSON.stringify({ v: 1, url: 'https://x.com', token: 't' });
    expect(parseJoin(raw)).toEqual({ kind: 'token', url: 'https://x.com', token: 't', mode: 'babybuddy' });
  });

  it('stamps the current version', () => {
    const json = JSON.parse(
      encodeJoin({ kind: 'token', url: 'https://x.com', token: 't', mode: 'babybuddy' }),
    );
    expect(json.v).toBe(JOIN_VERSION);
  });
});

describe('encodeJoin URL normalization', () => {
  it('adds https:// and strips a trailing slash', () => {
    const json = JSON.parse(
      encodeJoin({ kind: 'token', url: 'bb.example.com/', token: 't', mode: 'babybuddy' }),
    );
    expect(json.url).toBe('https://bb.example.com');
  });

  it('preserves an explicit http:// scheme', () => {
    const json = JSON.parse(
      encodeJoin({ kind: 'token', url: 'http://192.168.1.9:8000', token: 't', mode: 'babybuddy' }),
    );
    expect(json.url).toBe('http://192.168.1.9:8000');
  });
});

describe('parseJoin validation', () => {
  it('rejects non-JSON garbage', () => {
    expect(() => parseJoin('not a qr code')).toThrow(InvalidJoinError);
  });

  it('rejects an unsupported version', () => {
    const raw = JSON.stringify({ v: 999, url: 'https://x.com', token: 't' });
    expect(() => parseJoin(raw)).toThrow(InvalidJoinError);
  });

  it('rejects a payload with neither token nor full credentials', () => {
    expect(() => parseJoin(JSON.stringify({ v: 1, url: 'https://x.com' }))).toThrow(InvalidJoinError);
    expect(() => parseJoin(JSON.stringify({ v: 1, url: 'https://x.com', username: 'u' }))).toThrow(
      InvalidJoinError,
    );
  });

  it('rejects a missing/empty url', () => {
    expect(() => parseJoin(JSON.stringify({ v: 1, url: '', token: 't' }))).toThrow(InvalidJoinError);
    expect(() => parseJoin(JSON.stringify({ v: 1, token: 't' }))).toThrow(InvalidJoinError);
  });

  it('prefers the token shape when both token and credentials are present', () => {
    const raw = JSON.stringify({
      v: 1,
      url: 'https://x.com',
      token: 't',
      username: 'u',
      password: 'p',
    });
    expect(parseJoin(raw)).toEqual({
      kind: 'token',
      url: 'https://x.com',
      token: 't',
      mode: 'babybuddy',
    });
  });

  it('normalizes the url on parse', () => {
    const raw = JSON.stringify({ v: 1, url: 'bb.example.com/', token: 't' });
    expect(parseJoin(raw).url).toBe('https://bb.example.com');
  });
});
