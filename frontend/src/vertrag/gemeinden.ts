/**
 * Lädt contract/gemeinden.json (75 politische Gemeinden, AN-05). Angezeigt wird `name`,
 * gesendet `schluessel` (B5). Die Liste wird nie im Code abgetippt.
 *
 * Form der Datei: `{ meta: {...}, gemeinden: [{ bfs_nr, name, schluessel, wahlkreis }] }`
 * (eine reine Liste wird ebenfalls akzeptiert).
 */
import { z } from 'zod'
import { WohngemeindeSonderwert } from './enums'

export const GemeindeSchema = z.object({
  bfs_nr: z.number().optional(),
  name: z.string(),
  schluessel: z.string(),
  wahlkreis: z.string().optional(),
})
export type Gemeinde = z.infer<typeof GemeindeSchema>

const dateien = import.meta.glob<unknown>('../../../contract/gemeinden.json', {
  eager: true,
  import: 'default',
})

function laden(): { gemeinden: Gemeinde[]; fehler: string | null } {
  const roh = Object.values(dateien)[0]
  if (roh === undefined) return { gemeinden: [], fehler: 'contract/gemeinden.json fehlt' }
  const ergebnis = z
    .union([z.array(GemeindeSchema), z.object({ gemeinden: z.array(GemeindeSchema) }).transform((d) => d.gemeinden)])
    .safeParse(roh)
  if (!ergebnis.success) {
    console.error('contract/gemeinden.json hat unerwartetes Format', ergebnis.error)
    return { gemeinden: [], fehler: 'contract/gemeinden.json ungültig' }
  }
  return { gemeinden: ergebnis.data, fehler: null }
}

const { gemeinden, fehler } = laden()

export const GEMEINDEN: readonly Gemeinde[] = gemeinden
export const GEMEINDEN_GELADEN = fehler === null
export const GEMEINDEN_FEHLER = fehler

const nachSchluessel = new Map(GEMEINDEN.map((g) => [g.schluessel, g]))

/** Anzeigename zu einem Schlüssel; fällt auf den Schlüssel zurück, solange die Liste fehlt. */
export function gemeindeName(schluessel: string): string {
  return nachSchluessel.get(schluessel)?.name ?? schluessel
}

export function istSonderwert(wert: string): wert is WohngemeindeSonderwert {
  return (WohngemeindeSonderwert.werte as readonly string[]).includes(wert)
}
