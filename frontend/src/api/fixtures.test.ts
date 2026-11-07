import { describe, expect, it } from 'vitest'
import { ENTITAET_PLURAL, ROLLE, type Situation } from '../vertrag'
import { werteAntwortAus } from './antwort'
import { FIXTURES } from './fixtures'
import { periodeVon } from './situation'
import { erklaere } from './trace'

/** Jede Fixture aus contract/fixtures muss sich auswerten und erklären lassen. */
describe.each(FIXTURES.map((f) => [f.id, f] as const))('Fixture %s', (_id, f) => {
  const situation = f.request as Situation
  const periode = periodeVon(situation)!
  const familie = Object.values(situation[ENTITAET_PLURAL.familie])[0]
  const kinder = (familie[ROLLE.kinder] as string[]) ?? []

  it.skipIf(!f.response)('Antwort → Ergebnis', () => {
    const e = werteAntwortAus(f.response, periode)
    expect(e.kinder.map((k) => k.id)).toEqual(kinder)
  })

  it.skipIf(!f.trace)('Trace → Erklärung', () => {
    const e = erklaere(f.trace, periode, kinder)
    expect(e.schritte.length).toBeGreaterThan(0)
    expect(e.rechnungen).toHaveLength(kinder.length)
  })
})
