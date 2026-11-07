/**
 * Trace (/trace) → Erklärung für die Warum-Ansicht.
 *
 * 1. entitiesDescription lesen (Index jeder Person und der Familie im value-Array).
 * 2. Je Prüfschritt die Variablen im Trace suchen (`name<periode>`), Wert der richtigen Entität ziehen,
 *    Parameterwerte aus `parameters` der Knoten.
 * 3. Status einer Regel nur aus Variablen und Flags des Modells; keine eigene Rechtslogik.
 *    Welche Unterbestimmung (z. B. 4.1.a/b) gezeigt wird, folgt aus den Zuordnungstabellen in vertrag/.
 * 4. Robust: fehlender Knoten → NICHT_ERMITTELT.
 */
import { z } from 'zod'
import { normalisiereDatum } from './antwort'
import {
  ANGEBOT_REGEL,
  AUSNAHMEGRUND_REGEL,
  Ausnahmegrund,
  EINKOMMEN_REGEL,
  ENTITAET_PLURAL,
  F,
  FLAGS,
  HOECHSTBEITRAG_REGEL,
  JaNeinUnbekannt,
  PARAMETER,
  PARTNERSCHAFT_REGEL,
  PENSUM_REGEL,
  PRUEF_REGEL,
  Pruefstatus,
  REGEL,
  V,
  flagsDer,
  type Entitaet,
  type FlagName,
  type VariablenName,
} from '../vertrag'

// ---------- Schema der OpenFisca-Antwort ----------

const KnotenSchema = z.looseObject({
  value: z.array(z.unknown()).nullish(),
  dependencies: z.array(z.string()).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
})

export const TraceSchema = z.object({
  entitiesDescription: z.record(z.string(), z.array(z.string())),
  requestedCalculations: z.array(z.string()).optional(),
  trace: z.record(z.string(), KnotenSchema),
})
export type Trace = z.infer<typeof TraceSchema>
type Knoten = z.infer<typeof KnotenSchema>

// ---------- Ergebnis ----------

export type RegelStatus =
  | 'ERFUELLT'
  | 'NICHT_ERFUELLT'
  | 'UNBEKANNT'
  | 'ERMESSEN'
  | 'INFO'
  | 'NICHT_RELEVANT'
  | 'NICHT_ERMITTELT'

export type Fakt = { name: VariablenName | FlagName | string; person?: string; wert: unknown }

export type RegelZeile = {
  regelId: string
  status: RegelStatus
  /** Person, falls die Regel pro Kind geprüft wird. */
  kind?: string
  fakten: Fakt[]
}

export type Pruefschritt =
  | 'wohnsitz'
  | 'pensum'
  | 'ausnahme'
  | 'alter'
  | 'angebot'
  | 'einkommen'
  | 'aktuell'
  | 'hoechstbeitrag'
  | 'einkommensfaktor'
  | 'stunden'
  | 'kostendeckel'
  | 'beginn'

export type Schritt = { schritt: Pruefschritt; zeilen: RegelZeile[] }

/** Werte für die Rechnung nach dem Anhang KiBV, alle aus dem Trace (null = nicht ermittelt). */
export type Rechnung = {
  kind: string
  maxV: number | null
  z1: number | null
  z2: number | null
  me: number | null
  minMe: number | null
  maxMe: number | null
  faktor: number | null
  bProStunde: number | null
  stundenMonat: number | null
  tageProWoche: number | null
  stundenProTag: number | null
  wochenProMonat: number | null
  kostenMonat: number | null
  beitragTotal: number | null
  kostendeckelGreift: boolean | null
}

export type Erklaerung = {
  periode: string
  schritte: Schritt[]
  rechnungen: Rechnung[]
  anwendung: {
    status: string | null
    kinder: { id: string; status: string | null }[]
    flags: { flag: FlagName; person?: string }[]
  }
}

export class TraceFehler extends Error {
  readonly roh: unknown
  constructor(nachricht: string, roh: unknown) {
    super(nachricht)
    this.name = 'TraceFehler'
    this.roh = roh
  }
}

// ---------- Lesen ----------

class Leser {
  private readonly t: Trace
  private readonly periode: string
  readonly familienId: string | undefined

  constructor(t: Trace, periode: string) {
    this.t = t
    this.periode = periode
    this.familienId = t.entitiesDescription[ENTITAET_PLURAL.familie]?.[0]
  }

  private knoten(name: string): Knoten | undefined {
    const exakt = this.t.trace[`${name}<${this.periode}>`]
    if (exakt) return exakt
    const schluessel = Object.keys(this.t.trace).find((k) => k.startsWith(`${name}<`))
    return schluessel === undefined ? undefined : this.t.trace[schluessel]
  }

  private index(entitaet: Entitaet, id: string): number {
    return this.t.entitiesDescription[ENTITAET_PLURAL[entitaet]]?.indexOf(id) ?? -1
  }

  /** Wert einer Familienvariable; undefined = nicht im Trace. */
  familie(name: VariablenName | FlagName): unknown {
    if (this.familienId === undefined) return undefined
    return normalisiereDatum(this.knoten(name)?.value?.[this.index('familie', this.familienId)])
  }

  /** Wert einer Personenvariable; undefined = nicht im Trace. */
  person(name: VariablenName | FlagName, id: string): unknown {
    const i = this.index('person', id)
    return i < 0 ? undefined : normalisiereDatum(this.knoten(name)?.value?.[i])
  }

  /** Alle Werte einer Personenvariable mit Personen-ID. */
  allePersonen(name: VariablenName): { id: string; wert: unknown }[] {
    const ids = this.t.entitiesDescription[ENTITAET_PLURAL.person] ?? []
    const werte = this.knoten(name)?.value
    return werte ? ids.map((id, i) => ({ id, wert: normalisiereDatum(werte[i]) })) : []
  }

  /** Parameterwert aus irgendeinem Knoten, Schlüssel `name<datum>` oder `name`. */
  parameter(name: string): number | null {
    for (const k of Object.values(this.t.trace)) {
      for (const [schluessel, wert] of Object.entries(k.parameters ?? {})) {
        if (schluessel.split('<')[0] === name && typeof wert === 'number') return wert
      }
    }
    return null
  }
}

const zahl = (w: unknown): number | null => (typeof w === 'number' && Number.isFinite(w) ? w : null)
const text = (w: unknown): string | null => (typeof w === 'string' ? w : null)

/** Boolesche Modellvariable → Status; fehlend → NICHT_ERMITTELT. */
function aus(w: unknown, unbekannt = false): RegelStatus {
  if (unbekannt) return 'UNBEKANNT'
  if (w === true) return 'ERFUELLT'
  if (w === false) return 'NICHT_ERFUELLT'
  return 'NICHT_ERMITTELT'
}

/** Info-Zeile: Wert ermittelt → INFO, sonst NICHT_ERMITTELT. */
const info = (...werte: unknown[]): RegelStatus => (werte.some((w) => w === undefined) ? 'NICHT_ERMITTELT' : 'INFO')

const fakt = (name: Fakt['name'], wert: unknown, person?: string): Fakt => ({ name, wert, ...(person ? { person } : {}) })

// ---------- Erklärung ----------

/**
 * @param roh   Antwort von /trace
 * @param periode z. B. "2028-09"
 * @param kindIds Personen in der Rolle `kinder` (aus der Situation)
 */
export function erklaere(roh: unknown, periode: string, kindIds: readonly string[]): Erklaerung {
  const geprueft = TraceSchema.safeParse(roh)
  if (!geprueft.success) {
    console.error('Trace hat ein unerwartetes Format', geprueft.error.issues, roh)
    throw new TraceFehler('Trace hat ein unerwartetes Format', roh)
  }
  const l = new Leser(geprueft.data, periode)
  const fam = (n: VariablenName | FlagName) => l.familie(n)
  const flagF = (n: FlagName) => fam(n) === true
  const flagK = (n: FlagName, id: string) => l.person(n, id) === true

  const haushalt = text(fam(V.haushalt_form))
  const schritte: Schritt[] = []
  const schritt = (s: Pruefschritt, zeilen: RegelZeile[]) => zeilen.length > 0 && schritte.push({ schritt: s, zeilen })

  // KiBG-4.1 Wohnsitz
  schritt('wohnsitz', [
    {
      regelId: PRUEF_REGEL.wohnsitz,
      status: aus(fam(V.wohnsitz_erfuellt), fam(V.wohnsitz_sg) === JaNeinUnbekannt.UNBEKANNT || flagF(F.flag_wohnsitz_unbekannt)),
      fakten: [fakt(V.wohngemeinde, fam(V.wohngemeinde))],
    },
  ])

  // KiBG-4.1.a/b Erwerbspensum
  const pensumErfuellt = fam(V.erwerbspensum_erfuellt)
  schritt('pensum', [
    {
      regelId: (haushalt && PENSUM_REGEL[haushalt as keyof typeof PENSUM_REGEL]) || PENSUM_REGEL.GEMEINSAMER_HAUSHALT,
      status: aus(pensumErfuellt, flagF(F.flag_pensum_unbekannt)),
      fakten: [
        fakt(V.haushalt_form, haushalt ?? undefined),
        ...l
          .allePersonen(V.erwerbspensum)
          .filter(({ id }) => !kindIds.includes(id))
          .map(({ id, wert }) => fakt(V.erwerbspensum, wert, id)),
      ],
    },
  ])

  // KiBG-4.2 / KiBV-12.1 Ausnahme vom Mindestpensum
  const grund = text(fam(V.ausnahmegrund))
  const ausnahmeZeilen: RegelZeile[] = [
    {
      regelId: REGEL.ausnahme,
      status:
        pensumErfuellt === true
          ? 'NICHT_RELEVANT'
          : flagF(F.flag_ausnahme_offen)
            ? 'ERMESSEN'
            : aus(fam(V.ausnahme_pensum_gewaehrt)),
      fakten: [fakt(V.ausnahmegrund, grund ?? undefined), fakt(V.ausnahme_entscheid, fam(V.ausnahme_entscheid))],
    },
  ]
  if (grund && grund !== Ausnahmegrund.KEINER && grund in AUSNAHMEGRUND_REGEL) {
    ausnahmeZeilen.push({
      regelId: AUSNAHMEGRUND_REGEL[grund as keyof typeof AUSNAHMEGRUND_REGEL],
      status: 'INFO',
      fakten: [fakt(V.ausnahmegrund, grund)],
    })
  }
  schritt('ausnahme', ausnahmeZeilen)

  // KiBG-4.3 Alter, pro Kind
  schritt(
    'alter',
    kindIds.map((id) => ({
      regelId: PRUEF_REGEL.alter,
      kind: id,
      status: aus(l.person(V.alter_kind_erfuellt, id)),
      fakten: [fakt(V.alter_monate, l.person(V.alter_monate, id), id), fakt(V.schulstufe, l.person(V.schulstufe, id), id)],
    })),
  )

  // KiBG-3.1–3.3 Angebot, pro Kind
  schritt(
    'angebot',
    kindIds.flatMap((id) => {
      const typ = text(l.person(V.angebot_typ, id))
      const angemeldet = l.person(V.angebot_angemeldet, id)
      const nichtAnerkannt = l.person(F.flag_angebot_nicht_anerkannt, id)
      const nichtAngemeldet = l.person(F.flag_angebot_nicht_angemeldet, id)
      return [
        {
          regelId: PRUEF_REGEL.angebot,
          kind: id,
          status: aus(l.person(V.angebot_erfuellt, id), flagK(F.flag_angebot_anmeldung_unbekannt, id)),
          fakten: [fakt(V.angebot_typ, typ ?? undefined, id), fakt(V.angebot_angemeldet, angemeldet, id)],
        },
        {
          regelId: (typ && ANGEBOT_REGEL[typ as keyof typeof ANGEBOT_REGEL]) || PRUEF_REGEL.angebotAnerkannt,
          kind: id,
          status: nichtAnerkannt === undefined ? 'NICHT_ERMITTELT' : nichtAnerkannt === true ? 'NICHT_ERFUELLT' : 'ERFUELLT',
          fakten: [fakt(V.angebot_typ, typ ?? undefined, id)],
        },
        {
          regelId: PRUEF_REGEL.anmeldung,
          kind: id,
          status: flagK(F.flag_angebot_anmeldung_unbekannt, id)
            ? 'UNBEKANNT'
            : nichtAngemeldet === undefined
              ? 'NICHT_ERMITTELT'
              : nichtAngemeldet === true
                ? 'NICHT_ERFUELLT'
                : 'ERFUELLT',
          fakten: [fakt(V.angebot_angemeldet, angemeldet, id)],
        },
      ]
    }),
  )

  // KiBV-8.1 / 8.2 Einkommen der Gesuchseinheit
  const einkommen: RegelZeile[] = [
    {
      regelId: (haushalt && EINKOMMEN_REGEL[haushalt as keyof typeof EINKOMMEN_REGEL]) || EINKOMMEN_REGEL.GEMEINSAMER_HAUSHALT,
      status: flagF(F.flag_me_unbekannt) ? 'UNBEKANNT' : info(fam(V.me_veranlagung_familie)),
      fakten: [
        ...l
          .allePersonen(V.me_veranlagung)
          .filter(({ id }) => !kindIds.includes(id))
          .map(({ id, wert }) => fakt(V.me_veranlagung, wert, id)),
        fakt(V.me_veranlagung_familie, fam(V.me_veranlagung_familie)),
      ],
    },
  ]
  for (const { id, wert } of l.allePersonen(V.partnerschaft)) {
    const regelId = text(wert) && PARTNERSCHAFT_REGEL[wert as keyof typeof PARTNERSCHAFT_REGEL]
    const gefestigt = l.person(V.partner_gefestigt, id)
    if (regelId && gefestigt !== undefined) {
      einkommen.push({
        regelId,
        status: aus(gefestigt),
        fakten: [fakt(V.partnerschaft, wert, id), fakt(V.konkubinat_jahre, l.person(V.konkubinat_jahre, id), id)],
      })
    }
  }
  schritt('einkommen', einkommen)

  // KiBV-11.1/11.2 aktuelle Gegebenheiten (nur mit Antrag)
  if (fam(V.antrag_aktuelle_gegebenheiten) === true) {
    schritt('aktuell', [
      {
        regelId: PRUEF_REGEL.aktuelleGegebenheiten,
        status: flagF(F.flag_me_aktuell_angewendet) ? 'ERFUELLT' : flagF(F.flag_me_aktuell_unter_schwelle) ? 'NICHT_ERFUELLT' : 'NICHT_ERMITTELT',
        fakten: [fakt(V.me_aktuell, fam(V.me_aktuell)), fakt(V.me_massgebend, fam(V.me_massgebend))],
      },
    ])
  }

  // KiBV-14.1–14.3 Höchstbeitrag, pro Kind
  schritt(
    'hoechstbeitrag',
    kindIds.map((id) => {
      const stufe = text(l.person(V.altersstufe, id))
      const typ = text(l.person(V.angebot_typ, id))
      const tabelle = stufe ? HOECHSTBEITRAG_REGEL[stufe as keyof typeof HOECHSTBEITRAG_REGEL] : undefined
      const maxV = l.person(V.hoechstbeitrag_maxv, id)
      return {
        regelId: (tabelle && typ && tabelle[typ as keyof typeof tabelle]) || PRUEF_REGEL.hoechstbeitrag,
        kind: id,
        // Erfüllt, wenn das Modell einen Höchstbeitrag > 0 liefert und kein Flag „kein Höchstbeitrag“ setzt.
        status: flagK(F.flag_kein_hoechstbeitrag, id) ? 'UNBEKANNT' : maxV === undefined ? 'NICHT_ERMITTELT' : typeof maxV === 'number' && maxV > 0 ? 'ERFUELLT' : 'INFO',
        fakten: [fakt(V.altersstufe, stufe ?? undefined, id), fakt(V.angebot_typ, typ ?? undefined, id), fakt(V.hoechstbeitrag_maxv, maxV, id)],
      } satisfies RegelZeile
    }),
  )

  // KiBV-15 / Anhang: Einkommensfaktor
  const faktorZeilen: RegelZeile[] = [
    {
      regelId: PRUEF_REGEL.formel,
      status: info(fam(V.einkommensfaktor)),
      fakten: [fakt(V.me_massgebend, fam(V.me_massgebend)), fakt(V.einkommensfaktor, fam(V.einkommensfaktor))],
    },
  ]
  if (flagF(F.flag_me_ueber_maxme)) {
    faktorZeilen.push({ regelId: PRUEF_REGEL.maxMe, status: 'INFO', fakten: [fakt(F.flag_me_ueber_maxme, true)] })
  }
  schritt('einkommensfaktor', faktorZeilen)

  // KiBV-14.4 subventionierte Stunden, pro Kind
  schritt(
    'stunden',
    kindIds.map((id) => ({
      regelId: PRUEF_REGEL.umfang,
      kind: id,
      status: info(l.person(V.subventionierte_stunden_monat, id)),
      fakten: [
        fakt(V.betreuungstage_pro_woche, l.person(V.betreuungstage_pro_woche, id), id),
        fakt(V.betreuungsstunden_pro_tag, l.person(V.betreuungsstunden_pro_tag, id), id),
        fakt(V.subventionierte_stunden_monat, l.person(V.subventionierte_stunden_monat, id), id),
        ...(flagK(F.flag_stunden_gekappt, id) ? [fakt(F.flag_stunden_gekappt, true, id)] : []),
      ],
    })),
  )

  // KiBG-6.2 / 20.3 Kostendeckel, pro Kind
  schritt(
    'kostendeckel',
    kindIds.map((id) => {
      const greift = l.person(F.flag_kostendeckel_greift, id)
      return {
        regelId: PRUEF_REGEL.kostendeckel,
        kind: id,
        status: greift === undefined ? info(l.person(V.kosten_monat, id)) : 'INFO',
        fakten: [
          fakt(V.kosten_monat, l.person(V.kosten_monat, id), id),
          fakt(V.beitrag_total_kind, l.person(V.beitrag_total_kind, id), id),
          ...(greift === undefined ? [] : [fakt(F.flag_kostendeckel_greift, greift, id)]),
        ],
      } satisfies RegelZeile
    }),
  )

  // KiBG-9.2 / KiBV-25.1 Beginn der Beiträge, pro Kind
  schritt(
    'beginn',
    kindIds.map((id) => ({
      regelId: flagK(F.flag_uebergangsregel, id) ? PRUEF_REGEL.uebergang : PRUEF_REGEL.rueckwirkung,
      kind: id,
      status: info(l.person(V.beitrag_ab_datum, id)),
      fakten: [
        fakt(V.betreuungsbeginn, l.person(V.betreuungsbeginn, id), id),
        fakt(V.gesuchsdatum, fam(V.gesuchsdatum)),
        fakt(V.beitrag_ab_datum, l.person(V.beitrag_ab_datum, id), id),
        ...(flagK(F.flag_gesuch_verspaetet, id) ? [fakt(F.flag_gesuch_verspaetet, true, id)] : []),
      ],
    })),
  )

  const rechnungen: Rechnung[] = kindIds.map((id) => {
    const greift = l.person(F.flag_kostendeckel_greift, id)
    return {
      kind: id,
      maxV: zahl(l.person(V.hoechstbeitrag_maxv, id)),
      z1: zahl(fam(V.zusatzbeitrag_z1_pro_stunde)),
      z2: zahl(fam(V.zusatzbeitrag_z2_pro_stunde)),
      me: zahl(fam(V.me_massgebend)),
      minMe: l.parameter(PARAMETER.minMe),
      maxMe: l.parameter(PARAMETER.maxMe),
      faktor: zahl(fam(V.einkommensfaktor)),
      bProStunde: zahl(l.person(V.beitrag_pro_stunde_total, id)),
      stundenMonat: zahl(l.person(V.subventionierte_stunden_monat, id)),
      tageProWoche: zahl(l.person(V.betreuungstage_pro_woche, id)),
      stundenProTag: zahl(l.person(V.betreuungsstunden_pro_tag, id)),
      wochenProMonat: l.parameter(PARAMETER.wochenProMonat),
      kostenMonat: zahl(l.person(V.kosten_monat, id)),
      beitragTotal: zahl(l.person(V.beitrag_total_kind, id)),
      kostendeckelGreift: typeof greift === 'boolean' ? greift : null,
    }
  })

  const gesetzt = [
    ...flagsDer('familie')
      .filter((f) => flagF(f))
      .map((flag) => ({ flag })),
    ...kindIds.flatMap((id) =>
      flagsDer('person')
        .filter((f) => flagK(f, id))
        .map((flag) => ({ flag, person: id })),
    ),
  ]

  return {
    periode,
    schritte,
    rechnungen,
    anwendung: {
      status: text(fam(V.pruefstatus)),
      kinder: kindIds.map((id) => ({ id, status: text(l.person(V.pruefstatus_kind, id)) })),
      flags: gesetzt,
    },
  }
}

/** Alle Regel-IDs mit Status, z. B. für Tests und die Abdeckung. */
export function regelStatus(e: Erklaerung): Map<string, RegelStatus[]> {
  const m = new Map<string, RegelStatus[]>()
  for (const s of e.schritte) for (const z of s.zeilen) m.set(z.regelId, [...(m.get(z.regelId) ?? []), z.status])
  return m
}

/** Für die Anzeige: Wirkung eines gesetzten Flags (aus dem Vertrag). */
export const flagWirkung = (flag: FlagName) => FLAGS[flag].wirkung
export const istPruefstatus = (w: string | null): w is Pruefstatus =>
  w !== null && (Pruefstatus.werte as readonly string[]).includes(w)
