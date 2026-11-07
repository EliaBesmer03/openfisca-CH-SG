/**
 * Offline-Modus: lädt contract/fixtures/*.{request,response,trace}.json.
 *
 * Ein Request wird dem Fixture zugeordnet, dessen Eingaben gleich sind (Ausgaben = null werden
 * ignoriert, Personen werden über ihre Rolle und Position verglichen, nicht über die ID).
 * Die Antwort wird danach auf die Personen-IDs des Requests umbenannt.
 */
import { ENTITAET_PLURAL, ROLLE, type Situation } from '../vertrag'
import { RohSituationSchema, type RohSituation } from './antwort'

type Glob = Record<string, unknown>
const lade = (g: Glob, endung: string) =>
  Object.fromEntries(
    Object.entries(g).map(([pfad, inhalt]) => [pfad.split('/').pop()!.replace(endung, ''), inhalt]),
  )

const requests = lade(
  import.meta.glob<unknown>('../../../contract/fixtures/*.request.json', { eager: true, import: 'default' }),
  '.request.json',
)
const responses = lade(
  import.meta.glob<unknown>('../../../contract/fixtures/*.response.json', { eager: true, import: 'default' }),
  '.response.json',
)
const traces = lade(
  import.meta.glob<unknown>('../../../contract/fixtures/*.trace.json', { eager: true, import: 'default' }),
  '.trace.json',
)

export type Fixture = {
  /** Dateiname ohne Endung, z. B. `F01_standardfamilie`. */
  id: string
  request: RohSituation
  response: unknown | undefined
  trace: unknown | undefined
}

export const FIXTURES: readonly Fixture[] = Object.keys(requests)
  .sort()
  .flatMap((id) => {
    const r = RohSituationSchema.safeParse(requests[id])
    if (!r.success) {
      console.error(`Fixture ${id}.request.json ungültig`, r.error.issues)
      return []
    }
    return [{ id, request: r.data, response: responses[id], trace: traces[id] }]
  })

// ---------- Zuordnung ----------

const ROLLEN = [ROLLE.erziehungsberechtigte, ROLLE.partnerinnen, ROLLE.kinder] as const

/** Personen-IDs in Rollenreihenfolge, z. B. ['mutter','vater','lina'] → ['erziehungsberechtigte_0', …]. */
function positionen(s: RohSituation): Map<string, string> {
  const familie = Object.values(s[ENTITAET_PLURAL.familie])[0] ?? {}
  const karte = new Map<string, string>()
  for (const rolle of ROLLEN) {
    const ids = familie[rolle]
    if (Array.isArray(ids)) ids.forEach((id, i) => karte.set(id, `${rolle}_${i}`))
  }
  return karte
}

function nurEingaben(eintraege: Record<string, unknown>): Record<string, unknown> {
  const aus: Record<string, unknown> = {}
  for (const name of Object.keys(eintraege).sort()) {
    const w = eintraege[name]
    if (Array.isArray(w)) continue
    const werte = Object.entries(w as Record<string, unknown>).filter(([, x]) => x !== null)
    if (werte.length > 0) aus[name] = Object.fromEntries(werte.sort(([a], [b]) => a.localeCompare(b)))
  }
  return aus
}

/** Vergleichbare Form der Eingaben, unabhängig von Personen-IDs und Ausgaben. */
function kanonisch(s: RohSituation): string {
  const pos = positionen(s)
  const personen = Object.fromEntries(
    Object.entries(s[ENTITAET_PLURAL.person])
      .map(([id, daten]) => [pos.get(id) ?? id, nurEingaben(daten)] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  const familie = Object.values(s[ENTITAET_PLURAL.familie])[0] ?? {}
  const rollen = Object.fromEntries(
    ROLLEN.map((r) => [r, Array.isArray(familie[r]) ? familie[r].length : 0]),
  )
  return JSON.stringify({ personen, familie: nurEingaben(familie), rollen })
}

/** Ersetzt Personen-IDs (Schlüssel unter persons und Einträge in Listen). */
export function benenneUm(daten: unknown, umbenennung: Map<string, string>): unknown {
  const neu = (x: unknown, istPersonen: boolean): unknown => {
    if (Array.isArray(x)) return x.map((e) => (typeof e === 'string' ? (umbenennung.get(e) ?? e) : neu(e, false)))
    if (x !== null && typeof x === 'object') {
      return Object.fromEntries(
        Object.entries(x).map(([k, v]) => [
          istPersonen ? (umbenennung.get(k) ?? k) : k,
          neu(v, k === ENTITAET_PLURAL.person),
        ]),
      )
    }
    return x
  }
  return neu(daten, false)
}

export type Zuordnung = { fixture: Fixture; umbenennung: Map<string, string> }

/** Fixture mit denselben Eingaben wie `situation`, plus Umbenennung Fixture-ID → Request-ID. */
export function findeFixture(situation: Situation): Zuordnung | null {
  const s = RohSituationSchema.parse(situation)
  const ziel = kanonisch(s)
  const fixture = FIXTURES.find((f) => kanonisch(f.request) === ziel)
  if (!fixture) return null
  const posRequest = positionen(s)
  const zuRequestId = new Map([...posRequest].map(([id, p]) => [p, id]))
  const umbenennung = new Map<string, string>()
  for (const [fixId, p] of positionen(fixture.request)) {
    const reqId = zuRequestId.get(p)
    if (reqId !== undefined) umbenennung.set(fixId, reqId)
  }
  return { fixture, umbenennung }
}
