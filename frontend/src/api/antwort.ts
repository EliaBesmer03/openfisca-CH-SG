/**
 * Antwort der API (/calculate) auswerten → `Ergebnis`.
 *
 * Zweistufige zod-Validierung:
 *  1. Rohantwort hat die Form einer Situation (Personen, Familien, `{ periode: wert }`).
 *  2. Das daraus zusammengesetzte `Ergebnis` hat die erwarteten Typen (Enums aus dem Vertrag).
 *
 * Abweichung zum Plan: Beträge und Fakten sind `null`, wenn die Antwort sie nicht enthält
 * (nicht angefragt oder nicht ermittelt). Pflicht sind nur Prüfstatus der Familie und je Kind.
 * Keine Rechtslogik: Werte werden nur gelesen, nie berechnet.
 */
import { z } from 'zod'
import {
  Altersstufe,
  ENTITAET_PLURAL,
  F,
  Pruefstatus,
  ROLLE,
  V,
  flagsDer,
  type Entitaet,
  type FlagName,
  type VariablenName,
} from '../vertrag'

// ---------- Datumswerte ----------

/**
 * Abweichung der echten API von A8: berechnete Datumswerte kommen im HTTP-Datumsformat
 * („Tue, 15 Aug 2028 00:00:00 GMT“), Eingaben als Echo im gesendeten ISO-Format.
 * Beides wird auf ISO „YYYY-MM-DD“ normalisiert; alles andere bleibt unverändert.
 */
const HTTP_DATUM = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/

export function normalisiereDatum(w: unknown): unknown {
  if (typeof w !== 'string' || !HTTP_DATUM.test(w)) return w
  const ms = Date.parse(w)
  return Number.isNaN(ms) ? w : new Date(ms).toISOString().slice(0, 10)
}

// ---------- Stufe 1: Rohantwort ----------

const WertSchema = z.union([z.number(), z.string(), z.boolean(), z.null()])
const PeriodenwerteSchema = z.record(z.string(), WertSchema)

export const RohSituationSchema = z.object({
  [ENTITAET_PLURAL.person]: z.record(z.string(), z.record(z.string(), PeriodenwerteSchema)),
  [ENTITAET_PLURAL.familie]: z.record(
    z.string(),
    z.record(z.string(), z.union([z.array(z.string()), PeriodenwerteSchema])),
  ),
})
export type RohSituation = z.infer<typeof RohSituationSchema>

// ---------- Stufe 2: Ergebnis ----------

const betrag = z.number().nullable()
const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const flagListe = z.array(z.enum(F))

export const KindErgebnisSchema = z.object({
  id: z.string(),
  status: z.enum(Pruefstatus.werte),
  anspruch: z.boolean().nullable(),
  altersstufe: z.enum(Altersstufe.werte).nullable(),
  maxV: betrag,
  beitragProStundeTotal: betrag,
  subventionierteStunden: betrag,
  kostenMonat: betrag,
  beitragMindest: betrag,
  beitragTotal: betrag,
  zusatzbeitrag: betrag,
  anteilKanton: betrag,
  anteilGemeinde: betrag,
  schaetzungFallsBewilligt: betrag,
  restkosten: betrag,
  beitragAb: datum.nullable(),
  flags: flagListe,
})

export const ErgebnisSchema = z.object({
  periode: z.string().regex(/^\d{4}-\d{2}$/),
  status: z.enum(Pruefstatus.werte),
  familie: z.object({
    /** Schlüssel; Name über gemeindeName() aus gemeinden.json. */
    wohngemeinde: z.string().nullable(),
    zusatzbeitragZ1: betrag,
    zusatzbeitragZ2: betrag,
    meMassgebend: betrag,
    einkommensfaktor: betrag,
    beitragMindest: betrag,
    beitragTotal: betrag,
    restkosten: betrag,
    flags: flagListe,
  }),
  kinder: z.array(KindErgebnisSchema),
  ausnahmeOffen: z.boolean(),
  verordnungEntwurf: z.boolean(),
  zusatzbeitragPlatzhalter: z.boolean(),
})

export type KindErgebnis = z.infer<typeof KindErgebnisSchema>
export type Ergebnis = z.infer<typeof ErgebnisSchema>

export class AntwortFehler extends Error {
  readonly probleme: z.core.$ZodIssue[]
  readonly roh: unknown
  constructor(probleme: z.core.$ZodIssue[], roh: unknown) {
    super(`Antwort der API hat ein unerwartetes Format: ${z.prettifyError(new z.ZodError(probleme))}`)
    this.name = 'AntwortFehler'
    this.probleme = probleme
    this.roh = roh
  }
}

function pruefe<T>(schema: z.ZodType<T>, daten: unknown, roh: unknown): T {
  const r = schema.safeParse(daten)
  if (r.success) return r.data
  console.error('Antwort der API ungültig', r.error.issues, roh)
  throw new AntwortFehler(r.error.issues, roh)
}

/** Rohantwort von /calculate → Ergebnis. Wirft AntwortFehler bei unerwartetem Format. */
export function werteAntwortAus(roh: unknown, periode: string): Ergebnis {
  const s = pruefe(RohSituationSchema, roh, roh)
  const personen = s[ENTITAET_PLURAL.person]
  const familien = s[ENTITAET_PLURAL.familie]
  const familienId = Object.keys(familien)[0]
  const familie = familienId === undefined ? {} : familien[familienId]

  const ausFamilie = (name: VariablenName | FlagName): unknown => {
    const eintrag = familie[name]
    return Array.isArray(eintrag) || eintrag === undefined ? null : (eintrag[periode] ?? null)
  }
  const ausPerson = (id: string, name: VariablenName | FlagName): unknown =>
    personen[id]?.[name]?.[periode] ?? null
  const gesetzteFlags = (entitaet: Entitaet, lies: (n: FlagName) => unknown) =>
    flagsDer(entitaet).filter((n) => lies(n) === true)

  const rolle = familie[ROLLE.kinder]
  const kindIds = Array.isArray(rolle) ? rolle : []

  const kandidat = {
    periode,
    status: ausFamilie(V.pruefstatus),
    familie: {
      wohngemeinde: ausFamilie(V.wohngemeinde),
      zusatzbeitragZ1: ausFamilie(V.zusatzbeitrag_z1_pro_stunde),
      zusatzbeitragZ2: ausFamilie(V.zusatzbeitrag_z2_pro_stunde),
      meMassgebend: ausFamilie(V.me_massgebend),
      einkommensfaktor: ausFamilie(V.einkommensfaktor),
      beitragMindest: ausFamilie(V.beitrag_mindest_familie),
      beitragTotal: ausFamilie(V.beitrag_total_familie),
      restkosten: ausFamilie(V.restkosten_familie),
      flags: gesetzteFlags('familie', ausFamilie),
    },
    kinder: kindIds.map((id) => {
      const k = (name: VariablenName | FlagName) => ausPerson(id, name)
      return {
        id,
        status: k(V.pruefstatus_kind),
        anspruch: k(V.anspruch_kind),
        altersstufe: k(V.altersstufe),
        maxV: k(V.hoechstbeitrag_maxv),
        beitragProStundeTotal: k(V.beitrag_pro_stunde_total),
        subventionierteStunden: k(V.subventionierte_stunden_monat),
        kostenMonat: k(V.kosten_monat),
        beitragMindest: k(V.beitrag_mindest_kind),
        beitragTotal: k(V.beitrag_total_kind),
        zusatzbeitrag: k(V.zusatzbeitrag_kind),
        anteilKanton: k(V.anteil_kanton_kind),
        anteilGemeinde: k(V.anteil_gemeinde_kind),
        schaetzungFallsBewilligt: k(V.schaetzung_beitrag_total_kind),
        restkosten: k(V.restkosten_kind),
        beitragAb: normalisiereDatum(k(V.beitrag_ab_datum)),
        flags: gesetzteFlags('person', k),
      }
    }),
    ausnahmeOffen: ausFamilie(F.flag_ausnahme_offen) === true,
    verordnungEntwurf: ausFamilie(F.flag_verordnung_entwurf) === true,
    zusatzbeitragPlatzhalter: ausFamilie(F.flag_zusatzbeitrag_platzhalter) === true,
  }

  return pruefe(ErgebnisSchema, kandidat, roh)
}
