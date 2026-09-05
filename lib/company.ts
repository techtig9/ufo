/**
 * Company details used in the legal pages, the footer and contact copy.
 *
 * These were previously hardcoded placeholders — "[Your Name / Agency Name]",
 * "[your contact email]", "[date]" — scattered across nine files and shipped to
 * production pages including Terms and Privacy. The Master Command forbids
 * placeholder copy and requires the legal pages to carry real company
 * information.
 *
 * They are read from the environment rather than written into the source,
 * because a legal entity name, jurisdiction and contact address are facts about
 * your business that belong in deployment configuration, not in a commit — and
 * because filling them should not require a code change and a redeploy of the
 * repository.
 *
 * `npm run preflight` fails under CI or NODE_ENV=production while any value is
 * still unset, so an unfilled build cannot reach production unnoticed.
 *
 * All are read at build/render time on the server. They are NOT prefixed
 * NEXT_PUBLIC_ because none of them need to reach the browser as variables —
 * they are rendered into the markup server-side.
 *
 * SERVER COMPONENTS ONLY. Calling this from a 'use client' component produces
 * the real value during SSR and `— not set —` in the browser, because Next only
 * inlines NEXT_PUBLIC_ variables into the client bundle. That is a hydration
 * mismatch (React #418), and it silently broke every render of /contact until
 * the browser suite caught it — the page had passed while the variables were
 * unset on both sides and therefore happened to agree. Pass the value down as a
 * prop instead, as app/contact/page.tsx now does.
 */

const UNSET = '';

function read(name: string): string {
  return (process.env[name] ?? UNSET).trim();
}

export const COMPANY_FIELDS = {
  /** Legal operator of the service, as it should appear in the Terms. */
  legalName: 'UFO_COMPANY_LEGAL_NAME',
  /** Trading/brand name shown in the footer and About section. */
  displayName: 'UFO_COMPANY_DISPLAY_NAME',
  /** Where support and legal notices should be sent. */
  contactEmail: 'UFO_COMPANY_CONTACT_EMAIL',
  /** Governing law for the Terms, e.g. "England and Wales". */
  jurisdiction: 'UFO_COMPANY_JURISDICTION',
  /** Effective date shown on the legal documents. */
  legalEffectiveDate: 'UFO_LEGAL_EFFECTIVE_DATE',
  /** Public launch date shown on the changelog. */
  launchDate: 'UFO_LAUNCH_DATE',
} as const;

export type CompanyField = keyof typeof COMPANY_FIELDS;

/** Fields with no value configured. */
export function unsetCompanyFields(): CompanyField[] {
  return (Object.keys(COMPANY_FIELDS) as CompanyField[]).filter(
    (field) => read(COMPANY_FIELDS[field]) === UNSET
  );
}

/**
 * Renders a value for display. An unconfigured field renders as a clearly
 * marked gap rather than an empty string or a raw token, so if one does reach a
 * page it reads as an obvious omission instead of looking like real content.
 */
export function companyValue(field: CompanyField): string {
  return read(COMPANY_FIELDS[field]) || '— not set —';
}
