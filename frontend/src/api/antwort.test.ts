import { describe, expect, it, vi } from 'vitest'
import f01Response from '../../../contract/fixtures/F01_standardfamilie.response.json'
import { F, Pruefstatus, V } from '../vertrag'
import { AntwortFehler, werteAntwortAus } from './antwort'

const PERIODE = '2028-09'

describe('werteAntwortAus', () => {
  it('liest F1 (generierte Response) korrekt aus, Datum normalisiert', () => {
    const e = werteAntwortAus(f01Response, PERIODE)
    expect(e.status).toBe(Pruefstatus.ANSPRUCH)
    expect(e.familie).toMatchObject({
      wohngemeinde: 'ST_GALLEN',
      meMassgebend: 97000,
      einkommensfaktor: 0.5,
      beitragTotal: expect.closeTo(325, 2),
    })
    expect(e.familie.flags).toEqual([F.flag_verordnung_entwurf, F.flag_zusatzbeitrag_platzhalter])
    expect(e.kinder).toHaveLength(1)
    expect(e.kinder[0]).toMatchObject({
      id: 'lina',
      status: Pruefstatus.ANSPRUCH,
      maxV: 7.5,
      beitragProStundeTotal: 3.75,
      beitragMindest: expect.closeTo(325, 2),
      beitragTotal: expect.closeTo(325, 2),
      restkosten: expect.closeTo(715, 2),
      beitragAb: '2028-08-15',
      flags: [],
    })
  })

  it('nicht angefragte Werte sind null, nicht 0', () => {
    const roh = structuredClone(f01Response) as Record<string, Record<string, Record<string, unknown>>>
    delete roh.persons.lina[V.anteil_kanton_kind]
    delete roh.persons.lina[V.altersstufe]
    delete roh.familien.familie[V.zusatzbeitrag_z1_pro_stunde]
    const e = werteAntwortAus(roh, PERIODE)
    expect(e.kinder[0].anteilKanton).toBeNull()
    expect(e.kinder[0].altersstufe).toBeNull()
    expect(e.familie.zusatzbeitragZ1).toBeNull()
    expect(e.ausnahmeOffen).toBe(false)
  })

  it('liest gesetzte Flags von Familie und Kind', () => {
    const roh = structuredClone(f01Response) as Record<string, Record<string, Record<string, unknown>>>
    const fam = roh.familien.familie
    const kind = roh.persons.lina
    for (const ziel of [fam, kind]) for (const n of Object.keys(ziel)) if (n.startsWith('flag_')) ziel[n] = { [PERIODE]: false }
    fam[F.flag_ausnahme_offen] = { [PERIODE]: true }
    fam[F.flag_verordnung_entwurf] = { [PERIODE]: true }
    kind[F.flag_stunden_gekappt] = { [PERIODE]: true }
    const e = werteAntwortAus(roh, PERIODE)
    expect(e.familie.flags).toEqual([F.flag_ausnahme_offen, F.flag_verordnung_entwurf])
    expect(e.ausnahmeOffen).toBe(true)
    expect(e.verordnungEntwurf).toBe(true)
    expect(e.kinder[0].flags).toEqual([F.flag_stunden_gekappt])
  })

  it('unbekannter Prüfstatus → AntwortFehler mit Rohantwort', () => {
    const roh = structuredClone(f01Response) as Record<string, Record<string, Record<string, unknown>>>
    roh.familien.familie.pruefstatus = { [PERIODE]: 'VIELLEICHT' }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      werteAntwortAus(roh, PERIODE)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AntwortFehler)
      expect((e as AntwortFehler).roh).toBe(roh)
      expect((e as AntwortFehler).message).toContain('status')
    }
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('Antwort ohne Situationsform → AntwortFehler', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => werteAntwortAus({ error: 'Variable unbekannt' }, PERIODE)).toThrow(AntwortFehler)
    expect(() => werteAntwortAus('<html>', PERIODE)).toThrow(AntwortFehler)
  })
})
