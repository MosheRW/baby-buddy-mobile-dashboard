import { displayUserName, sanitizeUsername } from '../userName';

describe('sanitizeUsername', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeUsername('grand ma')).toBe('grand_ma');
  });

  it('collapses runs of whitespace into one underscore', () => {
    expect(sanitizeUsername('grand   ma')).toBe('grand_ma');
    expect(sanitizeUsername('a\tb')).toBe('a_b');
  });

  it('trims leading and trailing whitespace rather than encoding it', () => {
    expect(sanitizeUsername('  grandma  ')).toBe('grandma');
    expect(sanitizeUsername(' grand ma ')).toBe('grand_ma');
  });

  it('leaves an already-valid username untouched', () => {
    expect(sanitizeUsername('grand_ma')).toBe('grand_ma');
    expect(sanitizeUsername('moshe')).toBe('moshe');
  });

  it('strips leading/trailing underscores an edge space produced', () => {
    // The live field folds every space to '_', so an edge space arrives here as
    // an edge '_'; submit must not persist it (" grandma " → grandma).
    expect(sanitizeUsername('_grandma_')).toBe('grandma');
    expect(sanitizeUsername('_grand_ma_')).toBe('grand_ma');
  });

  it('handles an empty string', () => {
    expect(sanitizeUsername('   ')).toBe('');
    expect(sanitizeUsername('___')).toBe('');
  });
});

describe('displayUserName', () => {
  it('renders underscores as spaces', () => {
    expect(displayUserName('grand_ma')).toBe('grand ma');
  });

  it('handles multiple underscores', () => {
    expect(displayUserName('a_b_c')).toBe('a b c');
  });

  it('leaves a plain name untouched', () => {
    expect(displayUserName('moshe')).toBe('moshe');
  });
});

describe('round-trip', () => {
  it('display(sanitize(x)) recovers the spaced form', () => {
    expect(displayUserName(sanitizeUsername('grand ma'))).toBe('grand ma');
  });
});
