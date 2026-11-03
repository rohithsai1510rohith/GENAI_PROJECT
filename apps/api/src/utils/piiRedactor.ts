/**
 * PII Redaction utility for QueryLog and Telemetry.
 * Strictly redacts:
 * - Emails: [REDACTED_EMAIL]
 * - Phone numbers (Indian/international 10-12 digits): [REDACTED_PHONE]
 * - Indian vehicle registration numbers / license plates: [REDACTED_PLATE]
 *   Pattern per spec: [A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}
 */

// Regex patterns
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Indian phone numbers: +91-9876543210, 9876543210, 09876543210, with optional spaces/dashes
const PHONE_REGEX = /(?:\+?91[\s-]?)?(?:\b0)?[6-9]\d{4}[\s-]?\d{5}\b|\b\d{10}\b/g;

// Indian license plates: DL01AB1234, DL-01-AB-1234, KA 05 MC 1234, MH12A1234
const PLATE_REGEX = /\b[A-Za-z]{2}[-\s]?[0-9]{2}[-\s]?[A-Za-z]{1,2}[-\s]?[0-9]{4}\b/g;

export function redactPII(input: string): string {
  if (!input) return "";

  return input
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(PLATE_REGEX, "[REDACTED_PLATE]")
    .replace(PHONE_REGEX, "[REDACTED_PHONE]");
}
