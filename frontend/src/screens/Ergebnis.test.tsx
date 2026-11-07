// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import f01Response from '../../../contract/fixtures/F01_standardfamilie.response.json'
import f01Request from '../../../contract/fixtures/F01_standardfamilie.request.json'
import { erstelleClient } from '../api/client'
import { mitAllenAusgaben } from '../api/situation'
import { Ausnahmegrund, Entscheid, F, Pruefstatus, V } from '../vertrag'
import { Ergebnis } from './Ergebnis'

const P = '2028-09'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Nachgebildete API: Antwort hängt nur vom gesendeten ausnahme_entscheid ab. */
function apiMitEntscheid() {
  const gesendet: string[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const anfrage = JSON.parse(String(init.body))
    const entscheid: string = anfrage.familien.familie[V.ausnahme_entscheid]?.[P] ?? Entscheid.OFFEN
    gesendet.push(entscheid)
    const antwort = structuredClone(f01Response) as Record<string, Record<string, Record<string, unknown>>>
    const fam = antwort.familien.familie
    const kind = antwort.persons.lina
    if (entscheid === Entscheid.OFFEN) {
      fam[V.pruefstatus] = { [P]: Pruefstatus.PRUEFUNG_DURCH_GEMEINDE }
      fam[F.flag_ausnahme_offen] = { [P]: true }
      kind[V.pruefstatus_kind] = { [P]: Pruefstatus.PRUEFUNG_DURCH_GEMEINDE }
      kind[V.beitrag_total_kind] = { [P]: 0 }
      kind[V.schaetzung_beitrag_total_kind] = { [P]: 325 }
    } else if (entscheid === Entscheid.ABGELEHNT) {
      fam[V.pruefstatus] = { [P]: Pruefstatus.KEIN_ANSPRUCH }
      kind[V.pruefstatus_kind] = { [P]: Pruefstatus.KEIN_ANSPRUCH }
      kind[V.beitrag_total_kind] = { [P]: 0 }
    }
    return new Response(JSON.stringify(antwort), { status: 200 })
  })
  return gesendet
}

describe('Ergebnis bei PRUEFUNG_DURCH_GEMEINDE', () => {
  it('zeigt Schätzung und simuliert Bewilligung und Ablehnung', async () => {
    const gesendet = apiMitEntscheid()
    const situation = mitAllenAusgaben(f01Request, P)
    situation.familien.familie[V.ausnahmegrund] = { [P]: Ausnahmegrund.FAMILIAERE_BELASTUNG }
    const anfrage = { situation, periode: P, quelle: 'formular' as const, namen: { lina: 'Lina' } }
    const u = userEvent.setup()
    const leer = () => {}
    render(
      <Ergebnis anfragen={[anfrage]} client={erstelleClient('live')} onWarum={leer} onZurFrage={leer} onAendern={leer} onNeu={leer} />,
    )

    expect(await screen.findByText(/Die Gemeinde entscheidet. Falls sie zustimmt, etwa CHF 325 pro Monat/)).toBeTruthy()
    expect(screen.queryByText(/Sie erhalten/)).toBeNull()
    expect(screen.getByText(/Gesundheitliche Beeinträchtigung/)).toBeTruthy()
    // Artikel werden auf der Ergebnisseite nicht angezeigt
    expect(screen.queryByText(/KiBV-|KiBG-/)).toBeNull()

    await u.click(screen.getByRole('button', { name: 'Was, wenn die Gemeinde bewilligt?' }))
    await u.click(screen.getByRole('button', { name: 'Was, wenn die Gemeinde ablehnt?' }))

    const bewilligt = (await screen.findByRole('heading', { name: 'Falls die Gemeinde bewilligt' })).parentElement!
    expect(await within(bewilligt).findByText('Anspruch auf Beiträge')).toBeTruthy()
    expect(within(bewilligt).getByText(/CHF 325.00/)).toBeTruthy()
    const abgelehnt = screen.getByRole('heading', { name: 'Falls die Gemeinde ablehnt' }).parentElement!
    expect(await within(abgelehnt).findByText('Kein Anspruch')).toBeTruthy()

    expect(gesendet).toEqual([Entscheid.OFFEN, Entscheid.BEWILLIGT, Entscheid.ABGELEHNT])
  })
})
