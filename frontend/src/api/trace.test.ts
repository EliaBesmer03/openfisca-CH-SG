import { describe, expect, it, vi } from 'vitest'
import { texte } from '../texte/de'
import { rechnungZeilen } from '../texte/format'
import { F, Pruefstatus } from '../vertrag'
import { werteAntwortAus } from './antwort'
import { FIXTURES } from './fixtures'
import { TraceFehler, erklaere, regelStatus } from './trace'
import echtA8Trace from './testdaten_echt/F01_a8.trace.json'
import echtResponse from './testdaten_echt/F01_voll.response.json'
import echtTrace from './testdaten_echt/F01_voll.trace.json'

const P = '2028-09'

/** Prüft die Anforderungen aus dem Plan an die Erklärung von F1. */
function pruefeF1(trace: unknown, kind: string) {
  const e = erklaere(trace, P, [kind])
  const status = regelStatus(e)
  for (const id of ['KiBG-4.1', 'KiBG-4.1.b', 'KiBG-4.3', 'KiBG-3.1', 'KiBV-14.2.a']) {
    expect(status.get(id), id).toEqual(['ERFUELLT'])
  }
  const zeilen = rechnungZeilen(e.rechnungen[0])
  expect(zeilen.join('\n')).toContain('3.75 × 86.67 h')
  expect(zeilen.join('\n')).toContain('CHF 325.00')
  return e
}

describe('erklaere – echter Trace F1 (alle Ausgaben)', () => {
  const e = pruefeF1(echtTrace, 'kind_1')

  it('Prüfschritte in der Reihenfolge aus dem Plan', () => {
    expect(e.schritte.map((s) => s.schritt)).toEqual([
      'wohnsitz',
      'pensum',
      'ausnahme',
      'alter',
      'angebot',
      'einkommen',
      'hoechstbeitrag',
      'einkommensfaktor',
      'stunden',
      'kostendeckel',
      'beginn',
    ])
  })

  it('Ausnahme nicht nötig, Angebot KiBG-3.2.a und 3.3 erfüllt, Einkommen nach KiBV-8.1.a', () => {
    const s = regelStatus(e)
    expect(s.get('KiBG-4.2')).toEqual(['NICHT_RELEVANT'])
    expect(s.get('KiBG-3.2.a')).toEqual(['ERFUELLT'])
    expect(s.get('KiBG-3.3')).toEqual(['ERFUELLT'])
    expect(s.get('KiBV-8.1.a')).toEqual(['INFO'])
    // Übergangsregel gesetzt → Beginn nach KiBV-25.1
    expect(s.get('KiBV-25.1')).toEqual(['INFO'])
  })

  it('Rechnung: alle Werte und Parameter aus dem Trace', () => {
    expect(e.rechnungen[0]).toMatchObject({
      maxV: 7.5,
      z1: 0,
      z2: 0,
      me: 97000,
      minMe: 40000,
      maxMe: 154000,
      faktor: 0.5,
      bProStunde: 3.75,
      tageProWoche: 2,
      stundenProTag: 10,
      kostenMonat: 1040,
      kostendeckelGreift: false,
    })
    expect(rechnungZeilen(e.rechnungen[0])).toEqual([
      'B = (7.50 + 0.00) × (1 − (97’000 − 40’000) / (154’000 − 40’000)) + 0.00 = 3.75 CHF/h',
      '3.75 × 86.67 h (2 Tage × 10 h × 4.333 Wochen) = CHF 325.00 pro Monat',
      texte.warum.formel.deckelGreiftNicht('CHF 1’040.00'),
    ])
  })

  it('Datumswerte im HTTP-Format werden als ISO gelesen', () => {
    const beginn = e.schritte.find((s) => s.schritt === 'beginn')!.zeilen[0]
    expect(beginn.fakten.find((f) => f.name === 'beitrag_ab_datum')?.wert).toBe('2028-08-15')
  })

  it('Anwendungsschicht: Status und gesetzte Flags', () => {
    expect(e.anwendung.status).toBe(Pruefstatus.ANSPRUCH)
    expect(e.anwendung.kinder).toEqual([{ id: 'kind_1', status: Pruefstatus.ANSPRUCH }])
    expect(e.anwendung.flags).toEqual([
      { flag: F.flag_verordnung_entwurf },
      { flag: F.flag_zusatzbeitrag_platzhalter },
      { flag: F.flag_uebergangsregel, person: 'kind_1' },
    ])
  })
})

describe('erklaere – echter Trace F1 (Teilmenge aus A8)', () => {
  it('erfüllt dieselben Anforderungen, fehlende Flags sind nicht ermittelt statt falsch', () => {
    const e = pruefeF1(echtA8Trace, 'lina')
    expect(e.rechnungen[0].kostendeckelGreift).toBeNull()
  })
})

describe('erklaere – Fixture contract/fixtures/F01_standardfamilie.trace.json', () => {
  const fixture = FIXTURES.find((f) => f.id === 'F01_standardfamilie')
  it.skipIf(!fixture?.trace)('erfüllt die Anforderungen aus dem Plan', () => {
    pruefeF1(fixture!.trace, 'lina')
  })
})

describe('erklaere – Robustheit', () => {
  it('fehlende Knoten → NICHT_ERMITTELT, kein Absturz', () => {
    const e = erklaere({ entitiesDescription: { persons: ['k'], familien: ['f'] }, trace: {} }, P, ['k'])
    const s = regelStatus(e)
    expect(s.get('KiBG-4.1')).toEqual(['NICHT_ERMITTELT'])
    expect(s.get('KiBG-4.3')).toEqual(['NICHT_ERMITTELT'])
    expect(e.rechnungen[0].maxV).toBeNull()
    expect(rechnungZeilen(e.rechnungen[0])[0]).toContain('?')
  })

  it('falsche Form → TraceFehler', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => erklaere({ error: 'x' }, P, [])).toThrow(TraceFehler)
  })
})

describe('werteAntwortAus – echte Antwort F1', () => {
  it('liest float32-Werte und HTTP-Datum korrekt', () => {
    const e = werteAntwortAus(echtResponse, P)
    expect(e.status).toBe(Pruefstatus.ANSPRUCH)
    expect(e.kinder[0].beitragTotal).toBeCloseTo(325, 3)
    expect(e.kinder[0].anteilKanton).toBeCloseTo(162.5, 3)
    expect(e.kinder[0].beitragAb).toBe('2028-08-15')
    expect(e.verordnungEntwurf).toBe(true)
    expect(e.zusatzbeitragPlatzhalter).toBe(true)
    expect(e.kinder[0].flags).toEqual([F.flag_uebergangsregel])
  })
})
