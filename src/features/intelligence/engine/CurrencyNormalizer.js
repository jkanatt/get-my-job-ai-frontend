/**
 * Currency Normalizer — FX Conversion for Consistent USD Comparison
 * ═══════════════════════════════════════════════════════════════════════
 * Converts amounts from any currency to USD for consistent deduplication,
 * filtering, and display. Uses a static FX table with optional live updates.
 *
 * Critical for India coverage where amounts are in INR (crore/lakh) and
 * must be compared against USD amounts from global sources.
 */

// Static FX table (USD base). Updated periodically.
// In production, augment with live rates from exchangerate.host or open.er-api.com.
const FX_TO_USD = {
  USD: 1.0,
  INR: 1 / 83.5,    // Indian Rupee
  EUR: 1.09,         // Euro
  GBP: 1.27,         // British Pound
  SGD: 0.74,         // Singapore Dollar
  AED: 0.272,        // UAE Dirham
  CNY: 0.14,         // Chinese Yuan
  JPY: 0.0067,       // Japanese Yen
  KRW: 0.00075,      // South Korean Won
  CAD: 0.74,         // Canadian Dollar
  AUD: 0.65,         // Australian Dollar
  CHF: 1.14,         // Swiss Franc
  SEK: 0.095,        // Swedish Krona
  BRL: 0.20,         // Brazilian Real
  MYR: 0.22,         // Malaysian Ringgit
  THB: 0.029,        // Thai Baht
  IDR: 0.000063,     // Indonesian Rupiah
  PHP: 0.018,        // Philippine Peso
  VND: 0.000041,     // Vietnamese Dong
  NGN: 0.00065,      // Nigerian Naira
  KES: 0.0063,       // Kenyan Shilling
  ZAR: 0.055,        // South African Rand
};

// Indian unit multipliers (used in headlines like "₹200 crore", "Rs 50 lakh")
const INDIAN_UNITS = {
  crore: 1e7,  cr: 1e7,
  lakh: 1e5,   lac: 1e5,
  thousand: 1e3,
};

// Standard unit multipliers
const STANDARD_UNITS = {
  trillion: 1e12, t: 1e12,
  billion: 1e9, bn: 1e9, b: 1e9,
  million: 1e6, mn: 1e6, m: 1e6,
  thousand: 1e3, k: 1e3,
};

/**
 * Convert an amount to USD.
 *
 * @param {number} amount - Raw numeric amount
 * @param {string} unit - Unit string (e.g., "million", "crore", "bn")
 * @param {string} currency - ISO currency code (e.g., "USD", "INR", "EUR")
 * @returns {{ amountUsd: number, amountLocal: number, currency: string, fxRate: number }}
 */
export function toUSD(amount, unit = '', currency = 'USD') {
  if (!amount || isNaN(amount)) return { amountUsd: 0, amountLocal: 0, currency, fxRate: 1 };

  const normalizedUnit = (unit || '').toLowerCase().trim();
  const normalizedCurrency = (currency || 'USD').toUpperCase();

  // Apply unit multiplier
  let localAmount = amount;
  if (INDIAN_UNITS[normalizedUnit]) {
    localAmount = amount * INDIAN_UNITS[normalizedUnit];
  } else if (STANDARD_UNITS[normalizedUnit]) {
    localAmount = amount * STANDARD_UNITS[normalizedUnit];
  }

  // Convert to USD
  const fxRate = FX_TO_USD[normalizedCurrency] || 1.0;
  const amountUsd = localAmount * fxRate;

  return {
    amountUsd: Math.round(amountUsd),
    amountLocal: localAmount,
    currency: normalizedCurrency,
    fxRate,
  };
}

/**
 * Parse a text string and extract the amount in USD.
 * Handles: "$30M", "₹200 crore", "Rs 50 lakh", "€10 million", "$2.5B", etc.
 *
 * @param {string} text - Text containing an amount
 * @returns {{ amountUsd: number|null, currency: string, raw: string }}
 */
export function parseAmountToUSD(text) {
  if (!text) return { amountUsd: null, currency: 'USD', raw: '' };

  // Pattern: currency symbol + number + optional unit
  const match = text.match(
    /(?:US\$|\$|€|£|₹|Rs\.?|INR|SGD|AED|CNY|JPY|KRW)\s*([\d,]+(?:\.\d+)?)\s*(trillion|billion|bn|million|mn|crore|cr|lakh|lac|thousand|[tbmk])?/i
  );

  if (!match) {
    // Try without currency symbol: "30 million", "200 crore"
    const match2 = text.match(/([\d,]+(?:\.\d+)?)\s*(trillion|billion|bn|million|mn|crore|cr|lakh|lac|[tbmk])\b/i);
    if (!match2) return { amountUsd: null, currency: 'USD', raw: '' };

    const amount = parseFloat(match2[1].replace(/,/g, ''));
    const unit = match2[2];
    const currency = detectCurrency(text);
    const result = toUSD(amount, unit, currency);
    return { amountUsd: result.amountUsd, currency: result.currency, raw: match2[0] };
  }

  const amount = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2] || '';
  const currency = detectCurrencyFromSymbol(text, match[0]);
  const result = toUSD(amount, unit, currency);
  return { amountUsd: result.amountUsd, currency: result.currency, raw: match[0] };
}

/**
 * Detect currency from text context.
 */
export function detectCurrency(text) {
  if (!text) return 'USD';
  const t = text.toLowerCase();

  if (/₹|rs\.?|inr|crore|lakh|lac/i.test(t)) return 'INR';
  if (/€|eur/i.test(t)) return 'EUR';
  if (/£|gbp|sterling/i.test(t)) return 'GBP';
  if (/sgd|singapore dollar/i.test(t)) return 'SGD';
  if (/aed|dirham/i.test(t)) return 'AED';
  if (/cny|rmb|yuan|renminbi/i.test(t)) return 'CNY';
  if (/jpy|yen|¥/i.test(t)) return 'JPY';
  if (/krw|won/i.test(t)) return 'KRW';

  return 'USD'; // Default
}

function detectCurrencyFromSymbol(text, matched) {
  if (/₹|rs\.?/i.test(matched)) return 'INR';
  if (/€/.test(matched)) return 'EUR';
  if (/£/.test(matched)) return 'GBP';
  return detectCurrency(text);
}

/**
 * Get current FX rate for a currency.
 */
export function getFXRate(currency) {
  return FX_TO_USD[(currency || 'USD').toUpperCase()] || 1.0;
}

/**
 * Get all supported currencies.
 */
export function getSupportedCurrencies() {
  return Object.keys(FX_TO_USD);
}

/**
 * Format a USD amount for display.
 */
export function formatUSD(amount) {
  if (!amount) return '$0';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount}`;
}
