import { describe, expect, it } from 'vitest'
import { FLAGS, flagNamen, flagsDer } from './flags'
import { Pruefstatus } from './enums'
import { V, VARIABLEN, variablenDer } from './variablen'

describe('Vertrag A6', () => {
  it('enthält alle 26 Flags (16 Familie, 10 Person) mit Präfix flag_', () => {
    expect(flagNamen).toHaveLength(26)
    expect(flagsDer('familie')).toHaveLength(16)
    expect(flagsDer('person')).toHaveLength(10)
    for (const n of flagNamen) expect(n.startsWith('flag_')).toBe(true)
  })

  it('jedes Flag hat mindestens eine Regel-ID', () => {
    for (const n of flagNamen) expect(FLAGS[n].regeln.length).toBeGreaterThan(0)
  })

  it('hat 23 Eingaben mit Standardwert', () => {
    const eingaben = variablenDer({ schicht: 'eingabe' })
    expect(eingaben).toHaveLength(23)
    for (const n of eingaben) expect(VARIABLEN[n]).toHaveProperty('standard')
  })

  it('Namens-Konstanten entsprechen den Schlüsseln', () => {
    expect(V.me_massgebend).toBe('me_massgebend')
    expect(Pruefstatus.ANSPRUCH).toBe('ANSPRUCH')
    expect(Pruefstatus.werte).toHaveLength(5)
  })
})

describe('contract/ (Dateien des Rules-as-Code-Teams)', () => {
  it('regeln.json und gemeinden.json werden gelesen, sobald vorhanden', async () => {
    const { REGELN, REGELN_FEHLER } = await import('./regeln')
    const { GEMEINDEN, GEMEINDEN_FEHLER } = await import('./gemeinden')
    if (REGELN_FEHLER !== 'contract/regeln.json fehlt') expect(REGELN_FEHLER).toBeNull()
    if (GEMEINDEN_FEHLER !== 'contract/gemeinden.json fehlt') {
      expect(GEMEINDEN_FEHLER).toBeNull()
      expect(GEMEINDEN).toHaveLength(75)
    }
    expect(REGELN.every((r) => r.id.length > 0)).toBe(true)
  })
})

describe('Regel-IDs der Flags und Status sind in regeln.json auffindbar', () => {
  it('jede Regel-ID eines Flags (ausser Rechtsstand/Annahmen) führt zu einer Bestimmung mit Quelle', async () => {
    const { REGELN_GELADEN, regelnZu } = await import('./regeln')
    const { ANNAHME, RECHTSSTAND, STATUS_REGEL } = await import('./regel_ids')
    if (!REGELN_GELADEN) return
    const ausnahmen: string[] = [...Object.values(ANNAHME), RECHTSSTAND]
    const ids = [...flagNamen.flatMap((n) => FLAGS[n].regeln), ...Object.values(STATUS_REGEL)].filter((id) => !ausnahmen.includes(id!))
    for (const id of new Set(ids)) {
      const treffer = regelnZu(id!)
      expect(treffer.length, id).toBeGreaterThan(0)
      expect(treffer.every((r) => r.url), id).toBe(true)
    }
  })
})
