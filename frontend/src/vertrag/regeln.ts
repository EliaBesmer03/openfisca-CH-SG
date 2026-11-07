/**
 * Lädt contract/regeln.json (Format PLAN A9). Wortlaute kommen nur von dort, nie abgetippt.
 *
 * Solange die Datei im Repo fehlt, liefert der Loader eine leere Liste (`REGELN_GELADEN === false`);
 * die UI zeigt dann „Wortlaut noch nicht verfügbar“ statt abzustürzen.
 */
import { z } from 'zod'
import { Quellentyp } from './enums'

export const RegelSchema = z.object({
  id: z.string(),
  erlass: z.string(),
  fundstelle: z.string(),
  wortlaut: z.string(),
  quellentyp: z.enum(Quellentyp.werte),
  // A4 kennt auch Kombinationen wie „V, P“, „H, V“, „Entität“, „–“.
  umsetzung: z.string(),
  kurztext: z.string(),
  variablen: z.array(z.string()).default([]),
  parameter: z.array(z.string()).default([]),
  ambiguitaeten: z.array(z.string()).default([]),
  nicht_modelliert_grund: z.string().nullable().default(null),
  /** Quelle (PDF des Gesetzes bzw. Seite zur Verordnung). */
  url: z.string().optional(),
})
export type Regel = z.infer<typeof RegelSchema>

const dateien = import.meta.glob<unknown>('../../../contract/regeln.json', {
  eager: true,
  import: 'default',
})

function laden(): { regeln: Regel[]; fehler: string | null } {
  const roh = Object.values(dateien)[0]
  if (roh === undefined) return { regeln: [], fehler: 'contract/regeln.json fehlt' }
  const ergebnis = z.array(RegelSchema).safeParse(roh)
  if (!ergebnis.success) {
    console.error('contract/regeln.json entspricht nicht dem Format A9', ergebnis.error)
    return { regeln: [], fehler: 'contract/regeln.json ungültig' }
  }
  return { regeln: ergebnis.data, fehler: null }
}

const { regeln, fehler } = laden()

export const REGELN: readonly Regel[] = regeln
export const REGELN_GELADEN = fehler === null
export const REGELN_FEHLER = fehler

const nachId = new Map(REGELN.map((r) => [r.id, r]))

/** Genau die Regel mit dieser ID, sonst undefined. */
export function regel(id: string): Regel | undefined {
  return nachId.get(id)
}

/**
 * Regel(n) zu einer ID. Exakter Treffer, sonst alle Unterbestimmungen
 * (z. B. „KiBG-3.2“ → KiBG-3.2.a … d), weil Flags und Variablen in A6 teils
 * übergeordnete IDs verwenden.
 */
export function regelnZu(id: string): Regel[] {
  const exakt = nachId.get(id)
  if (exakt) return [exakt]
  return REGELN.filter((r) => r.id.startsWith(`${id}.`))
}
