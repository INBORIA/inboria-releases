const ALLOWED_COUNTRY_CODES = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT",
  "LU", "LV", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK",
];

export function isAllowedCountry(code: string): boolean {
  return ALLOWED_COUNTRY_CODES.includes(code.toUpperCase());
}

export { ALLOWED_COUNTRY_CODES };
