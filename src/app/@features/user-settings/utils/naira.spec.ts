import { formatNaira, toKobo, toNaira } from './naira';

/**
 * Money conversion, locked.
 *
 * The case that matters is `1.005`. The obvious `Math.round(naira * 100)`
 * returns 100 for it, because `1.005` is really `1.00499999999999989…` in
 * binary — so a fee typed with three decimals is silently a kobo short. Every
 * amount that leaves here must be a whole number of kobo, exactly.
 */
describe('toKobo', () => {
  it('converts whole naira', () => {
    expect(toKobo(37500)).toBe(3_750_000);
  });

  it('converts two decimal places exactly', () => {
    expect(toKobo(37500.5)).toBe(3_750_050);
    expect(toKobo(99999.99)).toBe(9_999_999);
  });

  it('survives the binary-float traps', () => {
    // `0.1 * 100` is 10.000000000000002; `0.07 * 100` is 7.000000000000001.
    expect(toKobo(0.1)).toBe(10);
    expect(toKobo(0.07)).toBe(7);
  });

  it('rounds a third decimal UP rather than losing it to float error', () => {
    // `Math.round(1.005 * 100)` is 100. This is the whole reason the
    // implementation reads digits instead of multiplying.
    expect(toKobo(1.005)).toBe(101);
    expect(toKobo(0.005)).toBe(1);
  });

  it('strips thousands separators', () => {
    expect(toKobo('37,500.50')).toBe(3_750_050);
  });

  it('treats absent values as nothing, not NaN', () => {
    expect(toKobo(null)).toBe(0);
    expect(toKobo(undefined)).toBe(0);
    expect(toKobo('')).toBe(0);
  });

  it('ALWAYS returns a whole number', () => {
    const inputs = [0, 1, 0.1, 0.07, 1.005, 12.345, 37500.5, 1e6, '8.2'];
    for (const input of inputs) {
      expect(Number.isInteger(toKobo(input))).toBe(true);
    }
  });
});

describe('toNaira / formatNaira', () => {
  it('round-trips through kobo without drift', () => {
    for (const naira of [0.01, 0.1, 1, 37500.5, 99999.99]) {
      expect(toNaira(toKobo(naira))).toBeCloseTo(naira, 2);
    }
  });

  it('formats for a reader', () => {
    expect(formatNaira(3_750_050)).toBe('₦37,500.50');
    expect(formatNaira(0)).toBe('₦0.00');
  });
});
