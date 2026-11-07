/** Verständliche Fehlermeldung zu einem Fehler aus API, Antwort oder Trace. */
import { AntwortFehler } from '../api/antwort'
import { ApiFehler } from '../api/client'
import { TraceFehler } from '../api/trace'
import { texte } from './de'

export function fehlerText(e: unknown): string {
  if (e instanceof ApiFehler) return texte.fehler[e.art]
  if (e instanceof AntwortFehler || e instanceof TraceFehler) return texte.fehler.format
  console.error(e)
  return texte.fehler.unbekannt
}
