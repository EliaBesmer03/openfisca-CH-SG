/**
 * Entitäten und Rollen aus PLAN Teil A6 (bindend).
 * Gruppen-Entität `Familie` (key `familie`, plural `familien`) mit den Rollen
 * erziehungsberechtigte (max. 2), partnerinnen (max. 1), kinder.
 */

export const ENTITAET = {
  person: 'person',
  familie: 'familie',
} as const
export type Entitaet = (typeof ENTITAET)[keyof typeof ENTITAET]

/** JSON-Schlüssel der Entitäten in der Situation (Plural). */
export const ENTITAET_PLURAL = {
  person: 'persons',
  familie: 'familien',
} as const satisfies Record<Entitaet, string>

/** JSON-Schlüssel der Rollen innerhalb einer Familie (Plural). */
export const ROLLE = {
  erziehungsberechtigte: 'erziehungsberechtigte',
  partnerinnen: 'partnerinnen',
  kinder: 'kinder',
} as const
export type Rolle = (typeof ROLLE)[keyof typeof ROLLE]

export const ROLLE_MAX: Record<Rolle, number | null> = {
  erziehungsberechtigte: 2,
  partnerinnen: 1,
  kinder: null,
}

/** Standard-IDs in der vom Frontend gebauten Situation (PLAN B5). */
export const ID = {
  familie: 'familie',
  eb: (nr: 1 | 2) => `eb_${nr}`,
  partner: 'partner_1',
  kind: (nr: number) => `kind_${nr}`,
} as const

/** Periode im Format YYYY-MM; Standard laut B5. */
export const STANDARD_PERIODE = '2028-09'

/** Wert einer Variable in JSON; `null` = Ausgabe anfragen. Enums als Name, Datum als YYYY-MM-DD. */
export type Wert = number | string | boolean | null
/** `{ "2028-09": wert }` */
export type Periodenwerte = Record<string, Wert>
export type Personendaten = Record<string, Periodenwerte>
export type Familiendaten = Record<string, Periodenwerte | string[]>

/** Situation für /calculate und /trace (OpenFisca Web API). */
export type Situation = {
  [ENTITAET_PLURAL.person]: Record<string, Personendaten>
  [ENTITAET_PLURAL.familie]: Record<string, Familiendaten>
}
