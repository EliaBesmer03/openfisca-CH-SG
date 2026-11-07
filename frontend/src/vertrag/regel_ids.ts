/**
 * Regel-IDs, die die UI direkt nennt (Banner, Hinweise, Fusszeile). Alle anderen
 * Regel-IDs kommen aus VARIABLEN bzw. FLAGS.
 */
import { Ausnahmegrund } from './enums'
import type { AngebotTyp, Altersstufe, HaushaltForm, Partnerschaft } from './enums'

export const REGEL = {
  zweck: 'KiBG-1.1',
  erziehungsberechtigte: 'KiBG-2.1',
  ausnahme: 'KiBG-4.2',
  datenbearbeitung: 'KiBG-8.1',
  verfuegungsdauer: ['KiBG-11.2', 'KiBV-16.1', 'KiBV-16.2'],
  auszahlung: 'KiBG-12.2',
  anteile: 'KiBG-18.1',
  zusatzbeitrag: 'KiBG-20.2',
  zustaendigeGemeinde: 'KiBV-2.1',
  plattformDaten: 'KiBV-21',
  formel: 'KiBV-Anh',
  vollzugsbeginn: 'KiBG-IV.1',
} as const

/** Regel-ID, die einen Prüfstatus direkt begründet; die übrigen Status begründen die Flags. */
export const STATUS_REGEL: Partial<Record<'NICHT_IN_KRAFT' | 'PRUEFUNG_DURCH_GEMEINDE', string>> = {
  NICHT_IN_KRAFT: 'KiBG-IV.1',
  PRUEFUNG_DURCH_GEMEINDE: 'KiBG-4.2',
}

/** Ausnahmegründe nach KiBV-12.1.a–c. */
export const AUSNAHMEGRUND_REGEL: Record<Exclude<Ausnahmegrund, 'KEINER'>, string> = {
  BERUFLICHE_INTEGRATION: 'KiBV-12.1.a',
  FAMILIAERE_BELASTUNG: 'KiBV-12.1.b',
  INDIKATION_KIND: 'KiBV-12.1.c',
}

/** Annahmen und Rechtsstand (keine Normen, nicht in regeln.json). */
export const ANNAHME = {
  wochenProMonat: 'AN-01',
  gemeinsameVeranlagung: 'AN-03',
  zusatzbeitraegeNull: 'AN-04',
} as const
export const RECHTSSTAND = 'A2'

/**
 * Nur UX (Frage 17 „besonderer Grund“ anbieten, B5). Gespiegelt aus den Parametern
 * kibg.anspruch.mindestpensum_einzeln / _gemeinsam. Die Rechtswirkung bestimmt allein die API.
 */
export const UX_MINDESTPENSUM = { einzeln: 20, gemeinsam: 120 } as const

// ---------- Erklärung: welche Unterbestimmung gilt für eine Eingabe (Tabelle A4) ----------
// Reine Zuordnung Eingabewert → Regel-ID für die Anzeige. Ob die Regel erfüllt ist,
// bestimmt allein das Modell (Variablen und Flags im Trace).


export const PRUEF_REGEL = {
  wohnsitz: 'KiBG-4.1',
  alter: 'KiBG-4.3',
  angebot: 'KiBG-3.1',
  angebotAnerkannt: 'KiBG-3.2',
  anmeldung: 'KiBG-3.3',
  aktuelleGegebenheiten: 'KiBV-11.2',
  umfang: 'KiBV-14.4',
  minMe: 'KiBV-15.1',
  maxMe: 'KiBV-15.2',
  formel: 'KiBV-Anh',
  kostendeckel: 'KiBG-6.2',
  kostendeckelTotal: 'KiBG-20.3',
  rueckwirkung: 'KiBG-9.2',
  uebergang: 'KiBV-25.1',
  hoechstbeitrag: 'KiBV-14',
} as const

/** KiBG-4.1.a (getrennt, je EB) bzw. 4.1.b (gemeinsam, Summe). */
export const PENSUM_REGEL: Record<HaushaltForm, string> = {
  GEMEINSAMER_HAUSHALT: 'KiBG-4.1.b',
  GETRENNTER_HAUSHALT: 'KiBG-4.1.a',
}

/** KiBV-8.1.a (gemeinsam) bzw. 8.1.b (getrennt, mit Partner/in). */
export const EINKOMMEN_REGEL: Record<HaushaltForm, string> = {
  GEMEINSAMER_HAUSHALT: 'KiBV-8.1.a',
  GETRENNTER_HAUSHALT: 'KiBV-8.1.b',
}

export const PARTNERSCHAFT_REGEL: Partial<Record<Partnerschaft, string>> = {
  EHE_ODER_EINGETRAGENE_PARTNERSCHAFT: 'KiBV-8.2.a',
  KONKUBINAT: 'KiBV-8.2.b',
}

/** KiBG-3.2.a–d nach Art des Angebots. */
export const ANGEBOT_REGEL: Partial<Record<AngebotTyp, string>> = {
  KITA: 'KiBG-3.2.a',
  TAGESFAMILIE: 'KiBG-3.2.b',
  SCHULERGAENZEND: 'KiBG-3.2.c',
  SONDERSCHULE_SCHULERGAENZEND: 'KiBG-3.2.d',
}

/** Höchstbeitrag MaxV: KiBV-14.1–14.3 nach Altersstufe × Angebot (A-09: Sonderschule wie 14.3.b; A-11: Lücken). */
export const HOECHSTBEITRAG_REGEL: Record<Altersstufe, Partial<Record<AngebotTyp, string>>> = {
  UNTER_18_MONATE: { KITA: 'KiBV-14.1.a', TAGESFAMILIE: 'KiBV-14.1.b' },
  AB_18_MONATE_BIS_EINSCHULUNG: { KITA: 'KiBV-14.2.a', TAGESFAMILIE: 'KiBV-14.2.b' },
  EINGESCHULT: {
    KITA: 'KiBV-14.3.a',
    SCHULERGAENZEND: 'KiBV-14.3.b',
    SONDERSCHULE_SCHULERGAENZEND: 'KiBV-14.3.b',
    TAGESFAMILIE: 'KiBV-14.3.c',
  },
}
