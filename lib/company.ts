/**
 * Company details used in legal pages, the footer and contact copy.
 *
 * These were previously hardcoded placeholders — "[Your Name / Agency Name]",
 * "[your contact email]", "[date]" — scattered across seven files and shipped
 * to production pages. The Master Command forbids placeholder copy and
 * requires the legal pages to carry real company information.
 *
 * They are collected here rather than invented: a legal entity name,
 * jurisdiction and contact address are facts about your business that only you
 * can supply, and fabricating them on Terms and Privacy pages would be worse
 * than an obvious gap.
 *
 * Set these before launch. `npm run preflight` fails while any value is still
 * a placeholder, so an unfilled build cannot reach production unnoticed.
 */

export const COMPANY = {
  /** Legal operator of the service, as it should appear in the Terms. */
  legalName: 'TODO_COMPANY_LEGAL_NAME',
  /** Trading/brand name shown in the footer and About section. */
  displayName: 'TODO_COMPANY_DISPLAY_NAME',
  /** Where support and legal notices should be sent. */
  contactEmail: 'TODO_COMPANY_CONTACT_EMAIL',
  /** Governing law for the Terms, e.g. "England and Wales". */
  jurisdiction: 'TODO_COMPANY_JURISDICTION',
  /** Effective date shown on the legal documents, ISO yyyy-mm-dd. */
  legalEffectiveDate: 'TODO_LEGAL_EFFECTIVE_DATE',
  /** Public launch date shown on the changelog. */
  launchDate: 'TODO_LAUNCH_DATE',
} as const;

export type CompanyField = keyof typeof COMPANY;

/** Fields still holding their placeholder value. */
export function unsetCompanyFields(): CompanyField[] {
  return (Object.keys(COMPANY) as CompanyField[]).filter((k) =>
    COMPANY[k].startsWith('TODO_')
  );
}

/**
 * Renders a value for display. An unset field renders as a clearly-marked gap
 * rather than the raw token, so if one does reach a page it reads as an
 * obvious omission instead of looking like real content.
 */
export function companyValue(field: CompanyField): string {
  const value = COMPANY[field];
  return value.startsWith('TODO_') ? '— not set —' : value;
}
