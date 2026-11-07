/**
 * Zugriff auf die OpenFisca-API, live über den Vite-Proxy oder offline aus Fixtures.
 * Liefert Rohdaten (calculate/trace) und das ausgewertete Ergebnis (berechne).
 */
import { API_BASIS, API_MODUS, type ApiModus } from '../konfiguration'
import type { Situation } from '../vertrag'
import { werteAntwortAus, type Ergebnis } from './antwort'
import { benenneUm, findeFixture } from './fixtures'

export type Endpunkt = 'calculate' | 'trace'

export type ApiFehlerArt =
  /** Server nicht erreichbar */
  | 'netzwerk'
  /** Server antwortet mit Fehlerstatus (z. B. 400 bei unbekannter Variable) */
  | 'http'
  /** Fixture-Modus: kein Demo-Fall mit diesen Eingaben */
  | 'kein_fixture'
  /** Fixture-Modus: Fall vorhanden, aber ohne Response/Trace-Datei */
  | 'fixture_unvollstaendig'

export class ApiFehler extends Error {
  readonly art: ApiFehlerArt
  readonly detail: unknown
  constructor(art: ApiFehlerArt, nachricht: string, detail?: unknown) {
    super(nachricht)
    this.name = 'ApiFehler'
    this.art = art
    this.detail = detail
  }
}

async function live(endpunkt: Endpunkt, situation: Situation): Promise<unknown> {
  let antwort: Response
  try {
    antwort = await fetch(`${API_BASIS}/${endpunkt}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(situation),
    })
  } catch (e) {
    throw new ApiFehler('netzwerk', `API nicht erreichbar (${API_BASIS}/${endpunkt})`, e)
  }
  const text = await antwort.text()
  let inhalt: unknown = text
  try {
    inhalt = JSON.parse(text)
  } catch {
    // Kein JSON (z. B. HTML-Fehlerseite); Text bleibt als Detail erhalten.
  }
  if (!antwort.ok) {
    console.error(`API ${endpunkt} antwortet mit ${antwort.status}`, inhalt)
    if (antwort.status === 403 && text === '') {
      console.error(
        'Hinweis: Leere 403-Antwort kommt meist vom macOS-AirPlay-Empfänger auf Port 5000, nicht von OpenFisca. ' +
          'Proxy-Ziel prüfen (API_ZIEL, Standard http://127.0.0.1:5000) oder OpenFisca auf anderem Port starten.',
      )
    }
    throw new ApiFehler('http', `API antwortet mit Status ${antwort.status}`, {
      status: antwort.status,
      inhalt,
    })
  }
  return inhalt
}

async function offline(endpunkt: Endpunkt, situation: Situation): Promise<unknown> {
  const zuordnung = findeFixture(situation)
  if (!zuordnung) {
    throw new ApiFehler('kein_fixture', 'Im Fixture-Modus gibt es keinen Demo-Fall mit diesen Angaben')
  }
  const { fixture, umbenennung } = zuordnung
  const daten = endpunkt === 'calculate' ? fixture.response : fixture.trace
  if (daten === undefined) {
    throw new ApiFehler(
      'fixture_unvollstaendig',
      `Fixture ${fixture.id} hat keine ${endpunkt === 'calculate' ? 'response' : 'trace'}-Datei`,
      fixture.id,
    )
  }
  return structuredClone(benenneUm(daten, umbenennung))
}

export function erstelleClient(modus: ApiModus = API_MODUS) {
  const roh = (endpunkt: Endpunkt, situation: Situation) =>
    modus === 'live' ? live(endpunkt, situation) : offline(endpunkt, situation)

  return {
    modus,
    calculate: (situation: Situation) => roh('calculate', situation),
    trace: (situation: Situation) => roh('trace', situation),
    /** /calculate senden und Antwort auswerten. */
    async berechne(situation: Situation, periode: string): Promise<Ergebnis> {
      return werteAntwortAus(await roh('calculate', situation), periode)
    },
  }
}

export type Client = ReturnType<typeof erstelleClient>

export const client = erstelleClient()
