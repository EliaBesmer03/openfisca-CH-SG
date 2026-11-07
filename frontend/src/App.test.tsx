// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { werteAntwortAus } from './api/antwort'
import { erstelleClient, type Client } from './api/client'
import { F, ROLLE, V, type Situation } from './vertrag'

beforeEach(() => {
  vi.stubGlobal('scrollTo', () => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const weiter = (u: ReturnType<typeof userEvent.setup>) => u.click(screen.getByRole('button', { name: /^(Weiter|Berechnen)$/ }))
const frage = () => screen.getByRole('heading', { level: 2 }).textContent
const datum = (label: string | RegExp, wert: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: wert } })

/**
 * Nachgebildetes Modell: beantwortet jede angefragte Ausgabe (null) mit einem festen Wert.
 * Nur das, was der Ablauf braucht: Wohnsitz ausserhalb → Abbruch, sonst Anspruch mit CHF 325 pro Kind.
 */
function fakeModell(gesendet: Situation[]): Client {
  const calculate = async (situation: Situation) => {
    gesendet.push(situation)
    const s = structuredClone(situation) as Situation
    for (const familie of Object.values(s.familien)) {
      const p = Object.keys(familie[V.haushalt_form] as object)[0]
      const ausserhalb = (familie[V.wohngemeinde] as Record<string, string> | undefined)?.[p] === 'AUSSERKANTONAL'
      const antwort: Record<string, unknown> = {
        [V.pruefstatus]: ausserhalb ? 'KEIN_ANSPRUCH' : 'ANSPRUCH',
        [F.flag_wohnsitz_nicht_sg]: ausserhalb,
        [V.wohngemeinde]: (familie[V.wohngemeinde] as Record<string, string> | undefined)?.[p] ?? null,
        [V.beitrag_total_familie]: 325 * (familie[ROLLE.kinder] as string[]).length,
      }
      for (const [name, werte] of Object.entries(familie)) {
        if (Array.isArray(werte) || werte[p] !== null) continue
        familie[name] = { [p]: name in antwort ? antwort[name] : name.startsWith('flag_') ? false : 0 } as never
      }
      for (const id of familie[ROLLE.kinder] as string[]) {
        const kind = s.persons[id]
        for (const [name, werte] of Object.entries(kind)) {
          if (werte[p] !== null) continue
          const w =
            name === V.pruefstatus_kind ? 'ANSPRUCH'
            : name === V.altersstufe ? 'AB_18_MONATE_BIS_EINSCHULUNG'
            : name === V.beitrag_ab_datum ? '2028-08-30'
            : name === V.beitrag_total_kind ? 325
            : name.startsWith('flag_') || name.startsWith('ist_') || name === V.anspruch_kind || name.endsWith('_erfuellt') ? false
            : 0
          kind[name] = { [p]: w }
        }
      }
      for (const id of (familie[ROLLE.partnerinnen] as string[] | undefined) ?? []) {
        s.persons[id][V.partner_gefestigt] = { [p]: false }
      }
    }
    return s
  }
  return {
    modus: 'live',
    calculate,
    trace: async () => {
      throw new Error('nicht nachgebildet')
    },
    berechne: async (situation, periode) => werteAntwortAus(await calculate(situation), periode),
  }
}

async function gemeinde(u: ReturnType<typeof userEvent.setup>) {
  expect(frage()).toBe('In welcher Gemeinde wohnen Sie?')
  await u.type(screen.getByLabelText('Gemeinde suchen'), 'St.Gallen')
  await u.selectOptions(screen.getByLabelText('Gemeinde'), 'ST_GALLEN')
  await weiter(u)
}

async function kind(u: ReturnType<typeof userEvent.setup>, name: string, geburt: string) {
  expect(frage()).toMatch(/wann ist es geboren/)
  await u.type(screen.getByLabelText('Vorname (freiwillig)'), name)
  datum('Geburtsdatum', geburt)
  await weiter(u)
  expect(frage()).toBe(`Wo wird ${name} betreut?`)
  // Vor dem Kindergarten kein Hort
  expect(screen.queryByLabelText(/Hort/)).toBeNull()
  await u.click(screen.getByLabelText(/^Kita/))
  await u.click(within(screen.getByRole('group', { name: /angemeldet/ })).getByLabelText('Ja'))
  await weiter(u)
  expect(frage()).toBe(`Wie viel Betreuung braucht ${name}?`)
  await u.type(screen.getByLabelText('Tage pro Woche'), '2')
  await u.type(screen.getByLabelText('Stunden pro Tag'), '10')
  await u.type(screen.getByLabelText('Preis pro Stunde ohne Essen'), '12')
  await weiter(u)
}

describe('App im Fixture-Modus', () => {
  const client = erstelleClient('fixtures')

  it('Startseite zeigt Banner, Startknopf und Demo F01', () => {
    render(<App client={client} />)
    expect(screen.getByRole('note').textContent).toContain('Simulation, keine Verfügung')
    expect(screen.getByRole('button', { name: 'Rechner starten' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /F1 · standardfamilie/ })).toBeTruthy()
  })

  it('Demo F01 → Ergebnis mit CHF 325, ohne Artikel', async () => {
    const u = userEvent.setup()
    render(<App client={client} />)
    await u.click(screen.getByRole('button', { name: /F1 · standardfamilie/ }))
    expect(await screen.findByText(/rund CHF 325 pro Monat für Lina/)).toBeTruthy()
    expect(screen.getByText('Anspruch auf Beiträge')).toBeTruthy()
    const tabelle = screen.getByRole('table')
    expect(within(tabelle).getAllByText('CHF 325.00')).toHaveLength(2)
    expect(within(tabelle).getByText('CHF 715.00')).toBeTruthy()
    expect(screen.queryByText(/KiBG-|KiBV-/)).toBeNull()
  })
})

describe('Fragebogen (Modell nachgebildet)', () => {
  it('Paar mit gemeinsamem Kind → ein Gesuch, CHF 325 für Lina', async () => {
    const gesendet: Situation[] = []
    const u = userEvent.setup()
    render(<App client={fakeModell(gesendet)} />)
    await u.click(screen.getByRole('button', { name: 'Rechner starten' }))

    await gemeinde(u)
    await kind(u, 'Lina', '2026-06-15')

    expect(frage()).toBe('Wohnen Sie mit einer Partnerin oder einem Partner zusammen?')
    await u.click(screen.getByLabelText('Ja'))
    await weiter(u)
    expect(frage()).toBe('Ist Ihre Partnerin oder Ihr Partner auch Elternteil von Lina?')
    await u.click(screen.getByLabelText('Ja'))
    await weiter(u)

    expect(frage()).toBe('Wie viel Prozent arbeiten Sie?')
    // Pflichtfeld leer → Hinweis, bleibt auf der Frage
    await weiter(u)
    expect(screen.getByRole('alert').textContent).toMatch(/Bitte füllen Sie/)
    await u.type(screen.getByLabelText('Ihr Pensum'), '100')
    await u.type(screen.getByLabelText('Pensum Ihrer Partnerin oder Ihres Partners'), '60')
    await weiter(u)

    expect(frage()).toMatch(/Steuerveranlagung/)
    await u.click(screen.getByLabelText(/gemeinsam besteuert/))
    expect(screen.queryByLabelText(/Einkommen und Vermögen Ihrer Partnerin/)).toBeNull()
    await u.type(screen.getByLabelText('Massgebendes Einkommen und Vermögen von Ihnen beiden'), '97000')
    await weiter(u)

    expect(await screen.findByText(/rund CHF 325 pro Monat für Lina/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Warum?' })).toBeTruthy()
    expect(screen.queryByText(/KiBG-|KiBV-/)).toBeNull()

    const letzte = gesendet[gesendet.length - 1]
    const fam = letzte.familien.familie
    expect(fam[ROLLE.erziehungsberechtigte]).toEqual(['eb_1', 'eb_2'])
    expect(letzte.persons.eb_1[V.me_veranlagung]).toEqual({ '2028-08': 97000 })
    expect(letzte.persons.eb_2[V.me_veranlagung]).toEqual({ '2028-08': 0 })
    expect(letzte.persons.kind_1[V.geburtsdatum]).toEqual({ '2028-08': '2026-06-15' })
  })

  it('Modell nicht erreichbar → Fehlermeldung, kein Weiterraten', async () => {
    const client = fakeModell([])
    client.calculate = async () => {
      throw new TypeError('fetch failed')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const u = userEvent.setup()
    render(<App client={client} />)
    await u.click(screen.getByRole('button', { name: 'Rechner starten' }))
    await u.type(screen.getByLabelText('Gemeinde suchen'), 'St.Gallen')
    await u.selectOptions(screen.getByLabelText('Gemeinde'), 'ST_GALLEN')
    await weiter(u)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(frage()).toBe('In welcher Gemeinde wohnen Sie?')
  })

  it('Wohnsitz ausserhalb → Ende nach Frage 1', async () => {
    const u = userEvent.setup()
    render(<App client={fakeModell([])} />)
    await u.click(screen.getByRole('button', { name: 'Rechner starten' }))
    await u.click(screen.getByLabelText('Ausserhalb des Kantons St.Gallen'))
    await weiter(u)
    expect(await screen.findByText(/Nach Ihren Angaben gibt es voraussichtlich keine Beiträge/)).toBeTruthy()
    expect(screen.getByText(/nicht im Kanton St.Gallen/)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Angabe ändern' }))
    expect(frage()).toBe('In welcher Gemeinde wohnen Sie?')
  })

  it('Patchwork: zweites Kind mit der Partnerin → zwei Gesuche und Summe', async () => {
    const gesendet: Situation[] = []
    const u = userEvent.setup()
    render(<App client={fakeModell(gesendet)} />)
    await u.click(screen.getByRole('button', { name: 'Rechner starten' }))

    await gemeinde(u)
    await kind(u, 'Lina', '2025-03-10')
    await u.click(screen.getByLabelText('Ja'))
    await weiter(u)
    await u.click(screen.getByLabelText('Nein'))
    await weiter(u)

    expect(frage()).toBe('Sind Sie verheiratet?')
    await u.click(screen.getByLabelText('Nein'))
    await u.type(screen.getByLabelText(/Seit wann/), '08.2027')
    await weiter(u)

    // Modell meldet: nicht gefestigt → nur Ihr Pensum und Einkommen
    expect(frage()).toBe('Wie viel Prozent arbeiten Sie?')
    expect(screen.queryByLabelText('Pensum Ihrer Partnerin oder Ihres Partners')).toBeNull()
    await u.type(screen.getByLabelText('Ihr Pensum'), '80')
    await weiter(u)
    expect(screen.queryByLabelText(/gemeinsam besteuert/)).toBeNull()
    await u.type(screen.getByLabelText('Ihr massgebendes Einkommen und Vermögen'), '60000')
    await weiter(u)
    expect(await screen.findByText(/rund CHF 325 pro Monat für Lina/)).toBeTruthy()

    await u.click(screen.getByRole('button', { name: 'Noch ein Kind hinzufügen' }))
    await kind(u, 'Mia', '2027-12-01')
    expect(frage()).toBe('Ist Ihre Partnerin oder Ihr Partner auch Elternteil von Mia?')
    await u.click(screen.getByLabelText('Ja'))
    await weiter(u)
    // Jetzt zählt die Partnerin: nur ihre Angaben werden nachgefragt
    expect(frage()).toBe('Wie viel Prozent arbeitet Ihre Partnerin oder Ihr Partner?')
    await u.type(screen.getByLabelText('Pensum Ihrer Partnerin oder Ihres Partners'), '60')
    await weiter(u)
    expect(frage()).toBe('Wie hoch ist das Einkommen Ihrer Partnerin oder Ihres Partners?')
    await u.type(screen.getByLabelText(/Einkommen und Vermögen Ihrer Partnerin/), '37000')
    await weiter(u)

    expect(await screen.findByText(/Zusammen erhalten Sie voraussichtlich rund CHF 650 pro Monat/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Gesuch für Lina' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Gesuch für Mia' })).toBeTruthy()

    const [lina, mia] = gesendet.slice(-2)
    expect(lina.familien.familie[ROLLE.partnerinnen]).toEqual(['partner_1'])
    expect(lina.persons.partner_1[V.konkubinat_jahre]).toEqual({ '2028-08': 1 })
    // nicht gefestigt: Pensum und Einkommen der Partnerin gehen nicht in Linas Gesuch
    expect(lina.persons.partner_1[V.me_veranlagung]).toBeUndefined()
    expect(lina.persons.partner_1[V.erwerbspensum]).toBeUndefined()
    expect(mia.familien.familie[ROLLE.erziehungsberechtigte]).toEqual(['eb_1', 'eb_2'])
    expect(mia.persons.eb_2[V.erwerbspensum]).toEqual({ '2028-08': 60 })
  })
})
