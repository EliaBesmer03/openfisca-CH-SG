import { afterEach, describe, expect, it, vi } from 'vitest'
import f01Request from '../../../contract/fixtures/F01_standardfamilie.request.json'
import f01Response from '../../../contract/fixtures/F01_standardfamilie.response.json'
import { Pruefstatus } from '../vertrag'
import { ApiFehler, erstelleClient } from './client'
import { FIXTURES } from './fixtures'
import { mitAllenAusgaben } from './situation'

const PERIODE = '2028-09'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Client im Fixture-Modus', () => {
  const client = erstelleClient('fixtures')

  it('lädt F01 aus contract/fixtures', () => {
    expect(FIXTURES.map((f) => f.id)).toContain('F01_standardfamilie')
  })

  it('F01 mit allen Ausgaben angefragt findet F01', async () => {
    const e = await client.berechne(mitAllenAusgaben(f01Request, PERIODE), PERIODE)
    expect(e.status).toBe(Pruefstatus.ANSPRUCH)
    expect(e.kinder.map((k) => k.id)).toEqual(['lina'])
    expect(e.kinder[0].beitragTotal).toBeCloseTo(325, 2)
  })

  it('der Fixture-Request selbst findet seine Antwort (Demo-Leiste)', async () => {
    const e = await client.berechne(f01Request, PERIODE)
    expect(e.kinder[0].id).toBe('lina')
  })

  it('andere Eingaben → ApiFehler kein_fixture', async () => {
    const anders = structuredClone(f01Request)
    anders.persons.lina.kosten_pro_stunde = { [PERIODE]: 13.37 } // kein Demo-Fall mit diesem Wert
    await expect(client.berechne(anders, PERIODE)).rejects.toMatchObject({ art: 'kein_fixture' })
  })

  const f01HatTrace = FIXTURES.some((f) => f.id === 'F01_standardfamilie' && f.trace !== undefined)
  it.skipIf(f01HatTrace)('Trace fehlt noch → ApiFehler fixture_unvollstaendig', async () => {
    await expect(client.trace(f01Request)).rejects.toBeInstanceOf(ApiFehler)
    await expect(client.trace(f01Request)).rejects.toMatchObject({ art: 'fixture_unvollstaendig' })
  })
})

describe('Client im Live-Modus', () => {
  const client = erstelleClient('live')

  it('POST /api/calculate mit der Situation als JSON', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(f01Response), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const e = await client.berechne(f01Request, PERIODE)
    expect(e.familie.meMassgebend).toBe(97000)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calculate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(f01Request) }),
    )
  })

  it('HTTP-Fehler → ApiFehler http mit Status und Inhalt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async () => new Response('{"error":"x"}', { status: 400 }))
    await expect(client.calculate(f01Request)).rejects.toMatchObject({
      art: 'http',
      detail: { status: 400, inhalt: { error: 'x' } },
    })
  })

  it('Server nicht erreichbar → ApiFehler netzwerk', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed')
    })
    await expect(client.calculate(f01Request)).rejects.toMatchObject({ art: 'netzwerk' })
  })
})
