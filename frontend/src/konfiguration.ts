export type ApiModus = 'fixtures' | 'live'

export const API_MODUS: ApiModus =
  import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'fixtures'

export const API_BASIS = '/api'

/** Gesuchsdatum im Demo-Modus (B5, Frage 16); live gilt das heutige Datum. */
export const DEMO_GESUCHSDATUM = '2028-08-30'

/**
 * Erster Monat, in dem Gesetz und Verordnung gelten (KiBG-IV.1, laut Kanton 1.8.2028).
 * Gerechnet wird der Monat des Gesuchs, frühestens dieser Monat.
 */
export const VOLLZUGSBEGINN_PERIODE = '2028-08'
