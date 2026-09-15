import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEE_PROFILES,
  PAYMENT_PROVIDER_IDS,
  getFeeProfile,
  calculateProviderFee,
  roundMoney,
  CURRENCIES,
  CURRENCY_CODES,
  isSupportedCurrency,
  COUNTRIES,
  COUNTRY_CODES,
  getCountry,
  resolveCurrency,
  suggestProviderForCountry,
  isProviderAvailableInCountry,
  defaultTaxRateForCountry,
} from '../lib/fees.ts';

describe('FEE_PROFILES', () => {
  it('contains an entry for every listed provider id', () => {
    PAYMENT_PROVIDER_IDS.forEach((id) => {
      const profile = FEE_PROFILES[id];
      assert.ok(profile, `missing profile for ${id}`);
      assert.ok(profile.percent >= 0, `${id} percent must be >= 0`);
      assert.ok(profile.fixed >= 0, `${id} fixed must be >= 0`);
      assert.ok(profile.label.length > 0, `${id} must have a label`);
    });
  });

  it('uses Shopify Payments rates (2.9% + $0.30) for the shopify profile', () => {
    assert.equal(FEE_PROFILES.shopify.percent, 2.9);
    assert.equal(FEE_PROFILES.shopify.fixed, 0.3);
  });

  it('has a zero-fee "none" profile', () => {
    assert.equal(FEE_PROFILES.none.percent, 0);
    assert.equal(FEE_PROFILES.none.fixed, 0);
  });

  it('charges more via PayPal than Shopify Payments', () => {
    assert.ok(FEE_PROFILES.paypal.percent > FEE_PROFILES.shopify.percent);
  });
});

describe('getFeeProfile', () => {
  it('returns the matching profile for a known id', () => {
    assert.equal(getFeeProfile('paypal').id, 'paypal');
  });

  it('falls back to "other" for unknown or missing ids', () => {
    assert.equal(getFeeProfile('mystery-processor').id, 'other');
    assert.equal(getFeeProfile(null)?.id, 'other');
    assert.equal(getFeeProfile(undefined)?.id, 'other');
    assert.equal(getFeeProfile('')?.id, 'other');
  });
});

describe('calculateProviderFee', () => {
  const closeTo = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ~= ${expected}`);

  it('applies Shopify Payments rates', () => {
    closeTo(calculateProviderFee(100, 'shopify'), 3.2);
    closeTo(calculateProviderFee(149.97, 'shopify'), 149.97 * 0.029 + 0.3);
  });

  it('applies PayPal rates (3.49% + $0.49)', () => {
    closeTo(calculateProviderFee(100, 'paypal'), 3.98);
  });

  it('charges only the fixed fee for flat-fee providers (iDEAL)', () => {
    closeTo(calculateProviderFee(250, 'ideal'), 0.29);
  });

  it('charges nothing for the "none" profile', () => {
    closeTo(calculateProviderFee(500, 'none'), 0);
  });

  it('defaults to the "other" profile for unknown providers', () => {
    closeTo(calculateProviderFee(100, 'unknown'), 3.2);
    closeTo(calculateProviderFee(100, undefined), 3.2);
  });
});

describe('roundMoney', () => {
  it('rounds to two decimals', () => {
    assert.equal(roundMoney(10.005), 10.01);
    assert.equal(roundMoney(3.14159), 3.14);
    assert.equal(roundMoney(2), 2);
  });
});

describe('currencies', () => {
  it('has unique codes with labels and symbols', () => {
    const codes = new Set(CURRENCY_CODES);
    assert.equal(codes.size, CURRENCIES.length);
    CURRENCIES.forEach((c) => {
      assert.match(c.code, /^[A-Z]{3}$/);
      assert.ok(c.label.length > 0);
      assert.ok(c.symbol.length > 0);
    });
  });

  it('recognizes supported currencies only', () => {
    assert.equal(isSupportedCurrency('usd'), true); // case-insensitive
    assert.equal(isSupportedCurrency('EUR'), true);
    assert.equal(isSupportedCurrency('XYZ'), false);
    assert.equal(isSupportedCurrency(null), false);
  });
});

describe('countries', () => {
  it('has unique codes with valid defaults', () => {
    const codes = new Set(COUNTRY_CODES);
    assert.equal(codes.size, COUNTRIES.length);
    COUNTRIES.forEach((c) => {
      assert.match(c.code, /^[A-Z]{2}$/);
      assert.ok(isSupportedCurrency(c.defaultCurrency), `${c.code} currency`);
      assert.ok(PAYMENT_PROVIDER_IDS.includes(c.defaultProvider), `${c.code} provider`);
    });
  });

  it('defaults Germany to EUR and a regional provider', () => {
    const de = getCountry('DE');
    assert.equal(de?.defaultCurrency, 'EUR');
    assert.equal(de?.defaultProvider, 'ideal');
  });

  it('returns null for unknown countries', () => {
    assert.equal(getCountry('ZZ'), null);
    assert.equal(getCountry(null), null);
  });
});

describe('resolveCurrency', () => {
  it('prefers an explicit valid currency', () => {
    assert.equal(resolveCurrency('gbp', 'US'), 'GBP');
  });

  it('falls back to the country default', () => {
    assert.equal(resolveCurrency(null, 'DE'), 'EUR');
    assert.equal(resolveCurrency('XXY', 'JP'), 'JPY');
  });

  it('falls back to USD when nothing matches', () => {
    assert.equal(resolveCurrency(null, null), 'USD');
    assert.equal(resolveCurrency('BAD', 'ZZ'), 'USD');
  });
});

describe('suggestProviderForCountry', () => {
  it('suggests iDEAL for the Netherlands', () => {
    assert.equal(suggestProviderForCountry('NL'), 'ideal');
  });

  it('suggests Bancontact for Belgium', () => {
    assert.equal(suggestProviderForCountry('BE'), 'bancontact');
  });

  it('suggests Shopify Payments for the US', () => {
    assert.equal(suggestProviderForCountry('US'), 'shopify');
  });

  it('falls back to "other" for unknown countries', () => {
    assert.equal(suggestProviderForCountry('ZZ'), 'other');
  });
});

describe('isProviderAvailableInCountry', () => {
  it('restricts regional providers to their countries', () => {
    assert.equal(isProviderAvailableInCountry('ideal', 'NL'), true);
    assert.equal(isProviderAvailableInCountry('ideal', 'US'), false);
    // East African mobile money: operator footprints
    assert.equal(isProviderAvailableInCountry('mpesa', 'KE'), true);
    assert.equal(isProviderAvailableInCountry('mpesa', 'TZ'), true);
    assert.equal(isProviderAvailableInCountry('mpesa', 'UG'), false); // MTN territory
    assert.equal(isProviderAvailableInCountry('mtnmomo', 'UG'), true);
    assert.equal(isProviderAvailableInCountry('mtnmomo', 'KE'), false);
    assert.equal(isProviderAvailableInCountry('telebirr', 'ET'), true);
    assert.equal(isProviderAvailableInCountry('telebirr', 'KE'), false);
  });

  it('makes non-regional providers universally available', () => {
    assert.equal(isProviderAvailableInCountry('paypal', 'US'), true);
    assert.equal(isProviderAvailableInCountry('paypal', 'JP'), true);
    assert.equal(isProviderAvailableInCountry('flutterwave', 'KE'), true);
  });
});

describe('East African markets', () => {
  it('suggests mobile money as the default rail', () => {
    assert.equal(suggestProviderForCountry('KE'), 'mpesa');
    assert.equal(suggestProviderForCountry('TZ'), 'mpesa');
    assert.equal(suggestProviderForCountry('UG'), 'mtnmomo');
    assert.equal(suggestProviderForCountry('RW'), 'mtnmomo');
    assert.equal(suggestProviderForCountry('ET'), 'telebirr');
  });

  it('defaults currency and VAT per country', () => {
    assert.equal(resolveCurrency(null, 'KE'), 'KES');
    assert.equal(resolveCurrency(null, 'ET'), 'ETB');
    assert.equal(getCountry('KE')?.defaultProvider, 'mpesa');
    assert.equal(defaultTaxRateForCountry('KE'), 16);
    assert.equal(defaultTaxRateForCountry('TZ'), 18);
    assert.equal(defaultTaxRateForCountry('ET'), 15);
  });

  it('prices M-Pesa fees (1.5% + 1)', () => {
    const closeTo = (actual: number, expected: number) =>
      assert.ok(Math.abs(actual - expected) < 1e-9);
    closeTo(calculateProviderFee(1000, 'mpesa'), 16); // KSh 1,000 order
    closeTo(calculateProviderFee(1000, 'flutterwave'), 28.3);
  });

  it('keeps zero-decimal shilling currencies formattable', () => {
    CURRENCY_CODES.forEach((code) => {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
      }).format(1000);
      assert.ok(formatted.length > 0, `${code} should format`);
    });
  });
});
