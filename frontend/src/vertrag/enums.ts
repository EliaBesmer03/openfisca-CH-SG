/**
 * Enums aus PLAN Teil A6 (bindend). In JSON werden Enums als Name gesendet und empfangen.
 *
 * Jedes Enum ist ein Objekt mit `werte` (Liste in Vertragsreihenfolge) und je einem
 * Eintrag pro Wert, z. B. `Pruefstatus.ANSPRUCH === 'ANSPRUCH'`.
 */

type Aufzaehlung<T extends readonly string[]> = { readonly werte: T } & {
  readonly [K in T[number]]: K
}

function aufzaehlung<const T extends readonly string[]>(...werte: T): Aufzaehlung<T> {
  const eintraege = Object.fromEntries(werte.map((w) => [w, w]))
  return Object.freeze({ ...eintraege, werte }) as Aufzaehlung<T>
}

export const JaNeinUnbekannt = aufzaehlung('JA', 'NEIN', 'UNBEKANNT')
export type JaNeinUnbekannt = (typeof JaNeinUnbekannt.werte)[number]

/**
 * Wohngemeinde: 75 Gemeinden aus contract/gemeinden.json (generiert, siehe gemeinden.ts)
 * plus die beiden Sonderwerte hier.
 */
export const WohngemeindeSonderwert = aufzaehlung('AUSSERKANTONAL', 'UNBEKANNT')
export type WohngemeindeSonderwert = (typeof WohngemeindeSonderwert.werte)[number]
/** Schlüssel einer der 75 Gemeinden (z. B. `ST_GALLEN`) oder ein Sonderwert. */
export type Wohngemeinde = string

export const HaushaltForm = aufzaehlung('GEMEINSAMER_HAUSHALT', 'GETRENNTER_HAUSHALT')
export type HaushaltForm = (typeof HaushaltForm.werte)[number]

export const AuslegungKibg41 = aufzaehlung('NUR_SUMME', 'KUMULATIV')
export type AuslegungKibg41 = (typeof AuslegungKibg41.werte)[number]

export const Ausnahmegrund = aufzaehlung(
  'KEINER',
  'BERUFLICHE_INTEGRATION',
  'FAMILIAERE_BELASTUNG',
  'INDIKATION_KIND',
)
export type Ausnahmegrund = (typeof Ausnahmegrund.werte)[number]

export const Entscheid = aufzaehlung('OFFEN', 'BEWILLIGT', 'ABGELEHNT')
export type Entscheid = (typeof Entscheid.werte)[number]

export const Partnerschaft = aufzaehlung(
  'KEINE',
  'EHE_ODER_EINGETRAGENE_PARTNERSCHAFT',
  'KONKUBINAT',
)
export type Partnerschaft = (typeof Partnerschaft.werte)[number]

export const Schulstufe = aufzaehlung(
  'VORSCHULALTER',
  'KINDERGARTEN',
  'PRIMARSCHULE',
  'OBERSTUFE_ODER_HOEHER',
)
export type Schulstufe = (typeof Schulstufe.werte)[number]

export const AngebotTyp = aufzaehlung(
  'KITA',
  'TAGESFAMILIE',
  'SCHULERGAENZEND',
  'SONDERSCHULE_SCHULERGAENZEND',
  'ANDERES',
)
export type AngebotTyp = (typeof AngebotTyp.werte)[number]

export const Altersstufe = aufzaehlung(
  'UNTER_18_MONATE',
  'AB_18_MONATE_BIS_EINSCHULUNG',
  'EINGESCHULT',
)
export type Altersstufe = (typeof Altersstufe.werte)[number]

export const Pruefstatus = aufzaehlung(
  'NICHT_IN_KRAFT',
  'KEIN_ANSPRUCH',
  'ANGABEN_FEHLEN',
  'PRUEFUNG_DURCH_GEMEINDE',
  'ANSPRUCH',
)
export type Pruefstatus = (typeof Pruefstatus.werte)[number]

/** Quellentyp (A3), verwendet in contract/regeln.json. */
export const Quellentyp = aufzaehlung('GESETZ', 'VERORDNUNG_ENTWURF', 'ERLAEUTERUNG', 'ANNAHME_TEAM')
export type Quellentyp = (typeof Quellentyp.werte)[number]
