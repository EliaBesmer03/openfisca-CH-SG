/**
 * Flags der Anwendungsschicht aus PLAN Teil A6 (bindend), mit Regel-ID und Wirkung (A7).
 *
 * Wirkung: KEIN → KEIN_ANSPRUCH, FEHLT → ANGABEN_FEHLEN, PRUEFUNG → PRUEFUNG_DURCH_GEMEINDE,
 * INFO → nur Erklärung. Das Frontend leitet daraus KEINEN Status ab (das tut die API);
 * die Wirkung dient nur der Sortierung und Darstellung.
 */
import type { Entitaet } from './entitaeten'

export type FlagWirkung = 'KEIN' | 'FEHLT' | 'PRUEFUNG' | 'INFO'

export type FlagDef = {
  entitaet: Entitaet
  /** Regel-IDs einzeln; `A2` / `AN-04` sind Verweise auf Teil A, keine Normen. */
  regeln: readonly string[]
  wirkung: FlagWirkung
}

export const FLAGS = {
  // Familie
  flag_wohnsitz_nicht_sg: { entitaet: 'familie', regeln: ['KiBG-4.1'], wirkung: 'KEIN' },
  flag_wohnsitz_unbekannt: { entitaet: 'familie', regeln: ['KiBG-4.1'], wirkung: 'FEHLT' },
  flag_pensum_unbekannt: { entitaet: 'familie', regeln: ['KiBG-4.1'], wirkung: 'FEHLT' },
  flag_haushalt_inkonsistent: { entitaet: 'familie', regeln: ['KiBG-4.1.b'], wirkung: 'FEHLT' },
  flag_pensum_unter_minimum: { entitaet: 'familie', regeln: ['KiBG-4.1.a', 'KiBG-4.1.b'], wirkung: 'INFO' },
  flag_ausnahme_kein_grund: { entitaet: 'familie', regeln: ['KiBG-4.2', 'KiBV-12'], wirkung: 'KEIN' },
  flag_ausnahme_offen: { entitaet: 'familie', regeln: ['KiBG-4.2'], wirkung: 'PRUEFUNG' },
  flag_ausnahme_abgelehnt: { entitaet: 'familie', regeln: ['KiBG-4.2'], wirkung: 'KEIN' },
  flag_me_unbekannt: { entitaet: 'familie', regeln: ['KiBG-5.3'], wirkung: 'FEHLT' },
  flag_me_aktuell_angewendet: { entitaet: 'familie', regeln: ['KiBV-11.2'], wirkung: 'INFO' },
  flag_me_aktuell_unter_schwelle: { entitaet: 'familie', regeln: ['KiBV-11.2'], wirkung: 'INFO' },
  flag_partner_nicht_gefestigt: { entitaet: 'familie', regeln: ['KiBV-8.2'], wirkung: 'INFO' },
  flag_pensum_mit_partner: { entitaet: 'familie', regeln: ['KiBG-4.1.b', 'KiBV-8.2'], wirkung: 'INFO' },
  flag_me_ueber_maxme: { entitaet: 'familie', regeln: ['KiBV-15.2'], wirkung: 'INFO' },
  flag_verordnung_entwurf: { entitaet: 'familie', regeln: ['A2'], wirkung: 'INFO' },
  flag_zusatzbeitrag_platzhalter: { entitaet: 'familie', regeln: ['KiBG-20.2', 'AN-04'], wirkung: 'INFO' },
  // Person (Kind)
  flag_kind_zu_jung: { entitaet: 'person', regeln: ['KiBG-4.3'], wirkung: 'KEIN' },
  flag_kind_zu_alt: { entitaet: 'person', regeln: ['KiBG-4.3'], wirkung: 'KEIN' },
  flag_angebot_nicht_anerkannt: { entitaet: 'person', regeln: ['KiBG-3.2'], wirkung: 'KEIN' },
  flag_angebot_nicht_angemeldet: { entitaet: 'person', regeln: ['KiBG-3.3'], wirkung: 'KEIN' },
  flag_angebot_anmeldung_unbekannt: { entitaet: 'person', regeln: ['KiBG-3.3'], wirkung: 'FEHLT' },
  flag_kein_hoechstbeitrag: { entitaet: 'person', regeln: ['KiBV-14'], wirkung: 'KEIN' },
  flag_stunden_gekappt: { entitaet: 'person', regeln: ['KiBV-14.4'], wirkung: 'INFO' },
  flag_kostendeckel_greift: { entitaet: 'person', regeln: ['KiBG-6.2', 'KiBG-20.3'], wirkung: 'INFO' },
  flag_gesuch_verspaetet: { entitaet: 'person', regeln: ['KiBG-9.2'], wirkung: 'INFO' },
  flag_uebergangsregel: { entitaet: 'person', regeln: ['KiBV-25.1'], wirkung: 'INFO' },
} as const satisfies Record<string, FlagDef>

export type FlagName = keyof typeof FLAGS

export const flagNamen = Object.keys(FLAGS) as FlagName[]

/** Namens-Konstanten: `F.flag_ausnahme_offen === 'flag_ausnahme_offen'`. */
export const F = Object.freeze(Object.fromEntries(flagNamen.map((n) => [n, n]))) as {
  readonly [K in FlagName]: K
}

export function flagsDer(entitaet: Entitaet): FlagName[] {
  return flagNamen.filter((n) => FLAGS[n].entitaet === entitaet)
}
