// Payment-provider fee profiles and currency/country catalog for MarginMind.
//
// The Shop model stores `paymentProvider` (which fee profile to use when
// computing transaction fees) and `currency` (what the amounts are denominated
// in). This module is the single source of truth for both, and is safe to use
// from the browser (no Node-only imports).

export interface FeeProfile {
  id: string;
  label: string;
  /** Percentage of the transaction amount. */
  percent: number;
  /** Fixed per-transaction fee in the shop's currency. */
  fixed: number;
}

// Approximate published rates for common payment processors (US-domestic,
// card-not-present). The fee estimate is for profit modeling, not settlement.
export const FEE_PROFILES: Record<string, FeeProfile> = {
  shopify: { id: 'shopify', label: 'Shopify Payments', percent: 2.9, fixed: 0.3 },
  stripe: { id: 'stripe', label: 'Stripe', percent: 2.9, fixed: 0.3 },
  paypal: { id: 'paypal', label: 'PayPal', percent: 3.49, fixed: 0.49 },
  square: { id: 'square', label: 'Square', percent: 2.9, fixed: 0.3 },
  klarna: { id: 'klarna', label: 'Klarna', percent: 3.29, fixed: 0.3 },
  ideal: { id: 'ideal', label: 'iDEAL', percent: 0, fixed: 0.29 },
  bancontact: { id: 'bancontact', label: 'Bancontact', percent: 0, fixed: 0.3 },
  sepa: { id: 'sepa', label: 'SEPA Direct Debit', percent: 0, fixed: 0.35 },
  none: { id: 'none', label: 'No payment processing', percent: 0, fixed: 0 },
  other: { id: 'other', label: 'Other / custom', percent: 2.9, fixed: 0.3 },
  // East Africa: mobile money dominates; card processors are secondary
  mpesa: { id: 'mpesa', label: 'M-Pesa', percent: 1.5, fixed: 1 },
  mtnmomo: { id: 'mtnmomo', label: 'MTN MoMo', percent: 1.5, fixed: 1 },
  telebirr: { id: 'telebirr', label: 'telebirr', percent: 0.5, fixed: 0.5 },
  flutterwave: { id: 'flutterwave', label: 'Flutterwave', percent: 2.8, fixed: 0.3 },
};

export const PAYMENT_PROVIDER_IDS = Object.keys(FEE_PROFILES);

export function getFeeProfile(providerId: string | null | undefined): FeeProfile {
  return FEE_PROFILES[providerId || 'other'] ?? FEE_PROFILES.other;
}

export interface CustomFeeProfile {
  percent: number;
  fixed: number;
}

/**
 * Resolve the effective fee profile for a shop. When the shop has custom
 * feePercent/feeFixed values (a Shop custom fee), they override the preset.
 */
export function resolveFeeProfile(
  providerId: string | null | undefined,
  custom?: { feePercent?: number | null; feeFixed?: number | null } | null
): FeeProfile {
  if (
    custom &&
    typeof custom.feePercent === 'number' &&
    typeof custom.feeFixed === 'number'
  ) {
    return {
      id: 'custom',
      label: 'Custom rate',
      percent: custom.feePercent,
      fixed: custom.feeFixed,
    };
  }
  return getFeeProfile(providerId);
}

/** Transaction fee for an amount under a given provider profile. */
export function calculateProviderFee(
  amount: number,
  providerId: string | null | undefined,
  custom?: { feePercent?: number | null; feeFixed?: number | null } | null
): number {
  const profile = resolveFeeProfile(providerId, custom);
  return amount * (profile.percent / 100) + profile.fixed;
}

/** Rounded money value (2 decimals) in the shop's currency. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

export interface CurrencyInfo {
  code: string;
  label: string;
  symbol: string;
}

// Common shop currencies; Intl handles the actual formatting, this list just
// powers the picker and documents the default for each country.
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: '$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: '$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', label: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', label: 'Polish Złoty', symbol: 'zł' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', label: 'Mexican Peso', symbol: '$' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: '$' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: '$' },
  // East Africa (mostly zero-decimal shillings/francs; Intl handles display)
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'TZS', label: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'UGX', label: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'RWF', label: 'Rwandan Franc', symbol: 'FRw' },
  { code: 'ETB', label: 'Ethiopian Birr', symbol: 'Br' },
  { code: 'BIF', label: 'Burundian Franc', symbol: 'FBu' },
  { code: 'SSP', label: 'South Sudanese Pound', symbol: 'SSP' },
  { code: 'SOS', label: 'Somali Shilling', symbol: 'Sh.' },
  { code: 'DJF', label: 'Djiboutian Franc', symbol: 'Fdj' },
  { code: 'CDF', label: 'Congolese Franc', symbol: 'FC' },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function isSupportedCurrency(code: string | null | undefined): boolean {
  return !!code && CURRENCY_CODES.includes(code.toUpperCase());
}

// ---------------------------------------------------------------------------
// Countries (drive the default currency + common payment provider)
// ---------------------------------------------------------------------------

export interface CountryInfo {
  code: string;
  name: string;
  defaultCurrency: string;
  defaultProvider: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'US', name: 'United States', defaultCurrency: 'USD', defaultProvider: 'shopify' },
  { code: 'CA', name: 'Canada', defaultCurrency: 'CAD', defaultProvider: 'shopify' },
  { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP', defaultProvider: 'shopify' },
  { code: 'IE', name: 'Ireland', defaultCurrency: 'EUR', defaultProvider: 'stripe' },
  { code: 'DE', name: 'Germany', defaultCurrency: 'EUR', defaultProvider: 'ideal' },
  { code: 'FR', name: 'France', defaultCurrency: 'EUR', defaultProvider: 'stripe' },
  { code: 'NL', name: 'Netherlands', defaultCurrency: 'EUR', defaultProvider: 'ideal' },
  { code: 'BE', name: 'Belgium', defaultCurrency: 'EUR', defaultProvider: 'bancontact' },
  { code: 'ES', name: 'Spain', defaultCurrency: 'EUR', defaultProvider: 'stripe' },
  { code: 'IT', name: 'Italy', defaultCurrency: 'EUR', defaultProvider: 'stripe' },
  { code: 'AT', name: 'Austria', defaultCurrency: 'EUR', defaultProvider: 'stripe' },
  { code: 'CH', name: 'Switzerland', defaultCurrency: 'CHF', defaultProvider: 'stripe' },
  { code: 'SE', name: 'Sweden', defaultCurrency: 'SEK', defaultProvider: 'stripe' },
  { code: 'NO', name: 'Norway', defaultCurrency: 'NOK', defaultProvider: 'stripe' },
  { code: 'DK', name: 'Denmark', defaultCurrency: 'DKK', defaultProvider: 'stripe' },
  { code: 'PL', name: 'Poland', defaultCurrency: 'PLN', defaultProvider: 'stripe' },
  { code: 'AU', name: 'Australia', defaultCurrency: 'AUD', defaultProvider: 'shopify' },
  { code: 'NZ', name: 'New Zealand', defaultCurrency: 'NZD', defaultProvider: 'shopify' },
  { code: 'JP', name: 'Japan', defaultCurrency: 'JPY', defaultProvider: 'stripe' },
  { code: 'SG', name: 'Singapore', defaultCurrency: 'SGD', defaultProvider: 'stripe' },
  { code: 'BR', name: 'Brazil', defaultCurrency: 'BRL', defaultProvider: 'stripe' },
  { code: 'MX', name: 'Mexico', defaultCurrency: 'MXN', defaultProvider: 'stripe' },
  { code: 'IN', name: 'India', defaultCurrency: 'INR', defaultProvider: 'stripe' },
  // East Africa — mobile money is the default rail in most markets
  { code: 'KE', name: 'Kenya', defaultCurrency: 'KES', defaultProvider: 'mpesa' },
  { code: 'TZ', name: 'Tanzania', defaultCurrency: 'TZS', defaultProvider: 'mpesa' },
  { code: 'UG', name: 'Uganda', defaultCurrency: 'UGX', defaultProvider: 'mtnmomo' },
  { code: 'RW', name: 'Rwanda', defaultCurrency: 'RWF', defaultProvider: 'mtnmomo' },
  { code: 'ET', name: 'Ethiopia', defaultCurrency: 'ETB', defaultProvider: 'telebirr' },
  { code: 'BI', name: 'Burundi', defaultCurrency: 'BIF', defaultProvider: 'other' },
  { code: 'SS', name: 'South Sudan', defaultCurrency: 'SSP', defaultProvider: 'mpesa' },
  { code: 'SO', name: 'Somalia', defaultCurrency: 'SOS', defaultProvider: 'other' },
  { code: 'DJ', name: 'Djibouti', defaultCurrency: 'DJF', defaultProvider: 'other' },
  { code: 'CD', name: 'DR Congo', defaultCurrency: 'CDF', defaultProvider: 'mpesa' },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

export function getCountry(code: string | null | undefined): CountryInfo | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? null;
}

/** Resolve a currency from an explicit value, falling back to the country default, then USD. */
export function resolveCurrency(currency?: string | null, country?: string | null): string {
  if (currency && isSupportedCurrency(currency)) return currency.toUpperCase();
  const countryInfo = getCountry(country);
  if (countryInfo) return countryInfo.defaultCurrency;
  return 'USD';
}

// ---------------------------------------------------------------------------
// Provider heuristics
// ---------------------------------------------------------------------------

// Regional providers make sense mainly for the countries where they dominate.
const REGIONAL_PROVIDERS: Record<string, string[]> = {
  ideal: ['NL'],
  bancontact: ['BE'],
  sepa: ['DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'AT', 'IE'],
  // East African mobile money: available per operator footprint
  mpesa: ['KE', 'TZ', 'CD', 'SS'],
  mtnmomo: ['UG', 'RW', 'CD'],
  telebirr: ['ET'],
};

/** Does this provider make sense for a shop in the given country? */
export function isProviderAvailableInCountry(providerId: string, countryCode: string): boolean {
  const regions = REGIONAL_PROVIDERS[providerId];
  if (!regions) return true;
  return regions.includes(countryCode.toUpperCase());
}

/**
 * Pick a sensible payment provider for a country when the user hasn't chosen
 * one: a dominant regional method if there is one, otherwise the country
 * default, otherwise 'other'.
 */
export function suggestProviderForCountry(countryCode: string): string {
  const country = getCountry(countryCode);
  if (!country) return 'other';
  const regional = Object.keys(REGIONAL_PROVIDERS).find((provider) =>
    isProviderAvailableInCountry(provider, country.code)
  );
  return regional ?? country.defaultProvider ?? 'other';
}

// ---------------------------------------------------------------------------
// Sales tax / VAT
// ---------------------------------------------------------------------------

// Indicative standard VAT rates for the supported countries; US uses state
// sales tax, so a typical combined rate is used as a planning default.
export const COUNTRY_TAX_RATES: Record<string, number> = {
  US: 7,
  CA: 13,
  GB: 20,
  IE: 23,
  DE: 19,
  FR: 20,
  NL: 21,
  BE: 21,
  ES: 21,
  IT: 22,
  AT: 20,
  CH: 8.1,
  SE: 25,
  NO: 25,
  DK: 25,
  PL: 23,
  AU: 10,
  NZ: 15,
  JP: 10,
  SG: 9,
  BR: 17,
  MX: 16,
  IN: 18,
  // East Africa (standard VAT rates)
  KE: 16,
  TZ: 18,
  UG: 18,
  RW: 18,
  ET: 15,
  BI: 18,
  SS: 18,
  SO: 5,
  DJ: 10,
  CD: 16,
};

/** Default tax rate (%) for a country; US-style 7% when unknown. */
export function defaultTaxRateForCountry(countryCode: string | null | undefined): number {
  if (!countryCode) return COUNTRY_TAX_RATES.US;
  return COUNTRY_TAX_RATES[countryCode.toUpperCase()] ?? COUNTRY_TAX_RATES.US;
}

/**
 * Resolve the tax rate for a shop: explicit shop-level rate when set,
 * otherwise the country default.
 */
export function resolveTaxRate(
  shopTaxRate: number | null | undefined,
  countryCode: string | null | undefined
): number {
  if (typeof shopTaxRate === 'number' && shopTaxRate >= 0) return shopTaxRate;
  return defaultTaxRateForCountry(countryCode);
}
