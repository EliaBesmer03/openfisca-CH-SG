/**
 * Alle Ein- und Ausgaben aus PLAN Teil A6 (bindend), jeweils mit Entität.
 * Flags stehen separat in flags.ts.
 *
 * `regeln` enthält die Regel-IDs einzeln ausgeschrieben (A6 schreibt z. B. „KiBG-4.1.a/b“).
 */
import {
  AngebotTyp,
  Altersstufe,
  AuslegungKibg41,
  Ausnahmegrund,
  Entscheid,
  HaushaltForm,
  JaNeinUnbekannt,
  Partnerschaft,
  Pruefstatus,
  Schulstufe,
  WohngemeindeSonderwert,
} from './enums'
import type { Entitaet, Rolle } from './entitaeten'

export type Schicht = 'eingabe' | 'recht' | 'anwendung'
export type VariablenTyp = 'float' | 'int' | 'bool' | 'date' | 'enum'

export type VariablenDef = {
  entitaet: Entitaet
  schicht: Schicht
  typ: VariablenTyp
  /** Erlaubte Werte bei typ 'enum'; `null` = Wohngemeinde (aus contract/gemeinden.json). */
  enumWerte?: readonly string[] | null
  /** Standardwert laut A6 (nur Eingaben). */
  standard?: number | boolean | string
  /** Für Personen-Eingaben: bei welchen Rollen die Eingabe gilt. */
  rollen?: readonly Rolle[]
  /** Ausgabe der Rechtsschicht, die in der Situation überschrieben werden darf (A6). */
  ueberschreibbar?: boolean
  einheit?: string
  regeln: readonly string[]
}

const EB_PARTNER = ['erziehungsberechtigte', 'partnerinnen'] as const satisfies readonly Rolle[]
const PARTNER = ['partnerinnen'] as const satisfies readonly Rolle[]
const KIND = ['kinder'] as const satisfies readonly Rolle[]

export const VARIABLEN = {
  // ---------- Eingaben ----------
  erwerbspensum: { entitaet: 'person', schicht: 'eingabe', typ: 'float', standard: 0, rollen: EB_PARTNER, einheit: '%', regeln: ['KiBG-4.1.a', 'KiBG-4.1.b'] },
  erwerbspensum_bekannt: { entitaet: 'person', schicht: 'eingabe', typ: 'bool', standard: true, rollen: EB_PARTNER, regeln: ['KiBG-4.1'] },
  me_veranlagung: { entitaet: 'person', schicht: 'eingabe', typ: 'float', standard: 0, rollen: EB_PARTNER, einheit: 'CHF/Jahr', regeln: ['KiBG-5.3', 'KiBV-9.1', 'KiBV-10.1'] },
  me_bekannt: { entitaet: 'person', schicht: 'eingabe', typ: 'bool', standard: true, rollen: EB_PARTNER, regeln: ['KiBG-5.3'] },
  partnerschaft: { entitaet: 'person', schicht: 'eingabe', typ: 'enum', enumWerte: Partnerschaft.werte, standard: Partnerschaft.KEINE, rollen: PARTNER, regeln: ['KiBV-8.2'] },
  konkubinat_jahre: { entitaet: 'person', schicht: 'eingabe', typ: 'float', standard: 0, rollen: PARTNER, einheit: 'Jahre', regeln: ['KiBV-8.2.b'] },
  geburtsdatum: { entitaet: 'person', schicht: 'eingabe', typ: 'date', standard: '1970-01-01', rollen: KIND, regeln: ['KiBG-4.3'] },
  /** Eingabe oder, ohne Eingabe, aus geburtsdatum berechnet. */
  alter_monate: { entitaet: 'person', schicht: 'eingabe', typ: 'int', standard: 0, rollen: KIND, einheit: 'Monate', regeln: ['KiBG-4.3', 'KiBV-14'] },
  schulstufe: { entitaet: 'person', schicht: 'eingabe', typ: 'enum', enumWerte: Schulstufe.werte, standard: Schulstufe.VORSCHULALTER, rollen: KIND, regeln: ['KiBG-4.3', 'KiBV-14'] },
  angebot_typ: { entitaet: 'person', schicht: 'eingabe', typ: 'enum', enumWerte: AngebotTyp.werte, standard: AngebotTyp.ANDERES, rollen: KIND, regeln: ['KiBG-3.2'] },
  angebot_angemeldet: { entitaet: 'person', schicht: 'eingabe', typ: 'enum', enumWerte: JaNeinUnbekannt.werte, standard: JaNeinUnbekannt.UNBEKANNT, rollen: KIND, regeln: ['KiBG-3.1', 'KiBG-3.3'] },
  betreuungstage_pro_woche: { entitaet: 'person', schicht: 'eingabe', typ: 'float', standard: 0, rollen: KIND, einheit: 'Tage/Woche', regeln: ['KiBV-7.1', 'KiBV-14.4'] },
  betreuungsstunden_pro_tag: { entitaet: 'person', schicht: 'eingabe', typ: 'float', standard: 0, rollen: KIND, einheit: 'Stunden/Tag', regeln: ['KiBV-14.4'] },
  kosten_pro_stunde: { entitaet: 'person', schicht: 'eingabe', typ: 'float', standard: 0, rollen: KIND, einheit: 'CHF', regeln: ['KiBG-6.2'] },
  betreuungsbeginn: { entitaet: 'person', schicht: 'eingabe', typ: 'date', standard: '1970-01-01', rollen: KIND, regeln: ['KiBG-9.2'] },
  wohngemeinde: { entitaet: 'familie', schicht: 'eingabe', typ: 'enum', enumWerte: null, standard: WohngemeindeSonderwert.UNBEKANNT, regeln: ['KiBG-4.1', 'KiBV-2.1'] },
  haushalt_form: { entitaet: 'familie', schicht: 'eingabe', typ: 'enum', enumWerte: HaushaltForm.werte, standard: HaushaltForm.GEMEINSAMER_HAUSHALT, regeln: ['KiBG-4.1.b', 'KiBV-8.1'] },
  auslegung_kibg_4_1: { entitaet: 'familie', schicht: 'eingabe', typ: 'enum', enumWerte: AuslegungKibg41.werte, standard: AuslegungKibg41.NUR_SUMME, regeln: ['KiBG-4.1'] },
  ausnahmegrund: { entitaet: 'familie', schicht: 'eingabe', typ: 'enum', enumWerte: Ausnahmegrund.werte, standard: Ausnahmegrund.KEINER, regeln: ['KiBV-12.1'] },
  ausnahme_entscheid: { entitaet: 'familie', schicht: 'eingabe', typ: 'enum', enumWerte: Entscheid.werte, standard: Entscheid.OFFEN, regeln: ['KiBG-4.2'] },
  antrag_aktuelle_gegebenheiten: { entitaet: 'familie', schicht: 'eingabe', typ: 'bool', standard: false, regeln: ['KiBV-11.1'] },
  me_aktuell: { entitaet: 'familie', schicht: 'eingabe', typ: 'float', standard: 0, einheit: 'CHF/Jahr', regeln: ['KiBG-5.4', 'KiBV-11.2'] },
  gesuchsdatum: { entitaet: 'familie', schicht: 'eingabe', typ: 'date', standard: '1970-01-01', regeln: ['KiBG-9.1'] },

  // ---------- Ausgaben Rechtsschicht (variables/kibg/) ----------
  ist_kind: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBG-2.1'] },
  ist_erziehungsberechtigt: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBG-2.1'] },
  ist_partner: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBG-2.1'] },
  wohnsitz_sg: { entitaet: 'familie', schicht: 'recht', typ: 'enum', enumWerte: JaNeinUnbekannt.werte, regeln: ['KiBG-4.1'] },
  wohnsitz_erfuellt: { entitaet: 'familie', schicht: 'recht', typ: 'bool', regeln: ['KiBG-4.1'] },
  zusatzbeitrag_z1_pro_stunde: { entitaet: 'familie', schicht: 'recht', typ: 'float', ueberschreibbar: true, einheit: 'CHF/h', regeln: ['KiBG-20.2', 'KiBV-24.1', 'KiBV-Anh'] },
  zusatzbeitrag_z2_pro_stunde: { entitaet: 'familie', schicht: 'recht', typ: 'float', ueberschreibbar: true, einheit: 'CHF/h', regeln: ['KiBG-20.2', 'KiBV-24.1', 'KiBV-Anh'] },
  erwerbspensum_erfuellt: { entitaet: 'familie', schicht: 'recht', typ: 'bool', regeln: ['KiBG-4.1.a', 'KiBG-4.1.b'] },
  ausnahme_pensum_gewaehrt: { entitaet: 'familie', schicht: 'recht', typ: 'bool', regeln: ['KiBG-4.2', 'KiBV-12'] },
  voraussetzung_erziehungsberechtigte_erfuellt: { entitaet: 'familie', schicht: 'recht', typ: 'bool', regeln: ['KiBG-4.1', 'KiBG-4.2'] },
  anteil_monat_ab_mindestalter: { entitaet: 'person', schicht: 'recht', typ: 'float', regeln: ['KiBG-4.3'] },
  alter_kind_erfuellt: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBG-4.3'] },
  angebot_erfuellt: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBG-3.1', 'KiBG-3.2', 'KiBG-3.3'] },
  anspruch_kind: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBG-3', 'KiBG-4'] },
  partner_gefestigt: { entitaet: 'person', schicht: 'recht', typ: 'bool', regeln: ['KiBV-8.2.a', 'KiBV-8.2.b'] },
  me_veranlagung_familie: { entitaet: 'familie', schicht: 'recht', typ: 'float', einheit: 'CHF/Jahr', regeln: ['KiBV-8.1.a', 'KiBV-8.1.b'] },
  me_massgebend: { entitaet: 'familie', schicht: 'recht', typ: 'float', einheit: 'CHF/Jahr', regeln: ['KiBG-5.1', 'KiBG-5.2', 'KiBG-5.3', 'KiBG-5.4', 'KiBV-11.1', 'KiBV-11.2'] },
  einkommensfaktor: { entitaet: 'familie', schicht: 'recht', typ: 'float', regeln: ['KiBV-Anh', 'KiBV-15.1', 'KiBV-15.2'] },
  altersstufe: { entitaet: 'person', schicht: 'recht', typ: 'enum', enumWerte: Altersstufe.werte, regeln: ['KiBV-14.1', 'KiBV-14.2', 'KiBV-14.3'] },
  anteil_monat_ab_18_monate: { entitaet: 'person', schicht: 'recht', typ: 'float', regeln: ['KiBV-14.2'] },
  hoechstbeitrag_maxv: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/h', regeln: ['KiBV-14.1', 'KiBV-14.2', 'KiBV-14.3'] },
  beitrag_pro_stunde_mindest: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/h', regeln: ['KiBG-6.1', 'KiBV-Anh'] },
  beitrag_pro_stunde_total: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/h', regeln: ['KiBV-Anh', 'KiBV-24'] },
  subventionierte_stunden_monat: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'h/Monat', regeln: ['KiBV-14.4'] },
  kosten_monat: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/Monat', regeln: ['KiBG-6.2'] },
  beitrag_mindest_kind: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/Monat', regeln: ['KiBG-6.1', 'KiBG-6.2', 'KiBG-20.1'] },
  beitrag_total_kind: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/Monat', regeln: ['KiBG-20.2', 'KiBG-20.3'] },
  anteil_kanton_kind: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/Monat', regeln: ['KiBG-18.1'] },
  anteil_gemeinde_kind: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/Monat', regeln: ['KiBG-18.1'] },
  zusatzbeitrag_kind: { entitaet: 'person', schicht: 'recht', typ: 'float', einheit: 'CHF/Monat', regeln: ['KiBG-20.2'] },
  beitrag_ab_datum: { entitaet: 'person', schicht: 'recht', typ: 'date', regeln: ['KiBG-9.2', 'KiBV-25.1'] },
  jahr_schulpflicht: { entitaet: 'person', schicht: 'recht', typ: 'int', regeln: ['KiBV-16.1'] },
  verfuegung_dauer_monate: { entitaet: 'person', schicht: 'recht', typ: 'int', einheit: 'Monate', regeln: ['KiBG-11.2', 'KiBV-16'] },

  // ---------- Ausgaben Anwendungsschicht (variables/anwendung/, nicht Recht) ----------
  pruefstatus_kind: { entitaet: 'person', schicht: 'anwendung', typ: 'enum', enumWerte: Pruefstatus.werte, regeln: [] },
  pruefstatus: { entitaet: 'familie', schicht: 'anwendung', typ: 'enum', enumWerte: Pruefstatus.werte, regeln: [] },
  schaetzung_beitrag_total_kind: { entitaet: 'person', schicht: 'anwendung', typ: 'float', einheit: 'CHF/Monat', regeln: [] },
  restkosten_kind: { entitaet: 'person', schicht: 'anwendung', typ: 'float', einheit: 'CHF/Monat', regeln: [] },
  beitrag_mindest_familie: { entitaet: 'familie', schicht: 'anwendung', typ: 'float', einheit: 'CHF/Monat', regeln: [] },
  beitrag_total_familie: { entitaet: 'familie', schicht: 'anwendung', typ: 'float', einheit: 'CHF/Monat', regeln: [] },
  restkosten_familie: { entitaet: 'familie', schicht: 'anwendung', typ: 'float', einheit: 'CHF/Monat', regeln: [] },
} as const satisfies Record<string, VariablenDef>

export type VariablenName = keyof typeof VARIABLEN

/** Namens-Konstanten: `V.erwerbspensum === 'erwerbspensum'`. */
export const V = Object.freeze(
  Object.fromEntries(Object.keys(VARIABLEN).map((n) => [n, n])),
) as { readonly [K in VariablenName]: K }

export const variablenNamen = Object.keys(VARIABLEN) as VariablenName[]

export function variablenDer(filter: Partial<Pick<VariablenDef, 'entitaet' | 'schicht'>>): VariablenName[] {
  return variablenNamen.filter((n) => {
    const d: VariablenDef = VARIABLEN[n]
    return (!filter.entitaet || d.entitaet === filter.entitaet) && (!filter.schicht || d.schicht === filter.schicht)
  })
}
