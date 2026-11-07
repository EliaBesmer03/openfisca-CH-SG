// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { erstelleClient } from '../api/client'
import { FIXTURES } from '../api/fixtures'
import { mitAllenAusgaben, periodeVon } from '../api/situation'
import type { Situation } from '../vertrag'
import { Ergebnis, type Anfrage } from './Ergebnis'
import { Warum } from './Warum'

afterEach(cleanup)
const client = erstelleClient('fixtures')
const leer = () => {}

function anfrage(prefix: string): Anfrage | null {
  const f = FIXTURES.find((x) => x.id.startsWith(prefix))
  if (!f) return null
  const periode = periodeVon(f.request as Situation)!
  return { situation: mitAllenAusgaben(f.request as Situation, periode), periode, quelle: 'demo' }
}

const f05 = anfrage('F05_')
const f01x = anfrage('F01x_')

describe('Grenzfälle aus contract/fixtures', () => {
  it.skipIf(!f05)('F05: Anspruch mit CHF 0 → nicht „Sie erhalten CHF 0“', async () => {
    render(<Ergebnis anfragen={[f05!]} client={client} onWarum={leer} onZurFrage={leer} onAendern={leer} onNeu={leer} />)
    expect(await screen.findByText(/Wegen Ihres Einkommens beträgt der Beitrag aber CHF 0/)).toBeTruthy()
    expect(screen.queryByText(/Sie erhalten voraussichtlich/)).toBeNull()
  })

  it.skipIf(!f01x)('F01x: vor Vollzugsbeginn keine Regelzeilen und keine Rechnung', async () => {
    render(<Warum anfrage={f01x!} client={client} onZurueck={leer} />)
    expect(await screen.findByText(/gelten das neue Gesetz und die Verordnung noch nicht/)).toBeTruthy()
    expect(screen.queryByText('nicht erfüllt')).toBeNull()
    expect(screen.queryByText(/Die Rechnung nach dem Anhang/)).toBeNull()
  })
})
