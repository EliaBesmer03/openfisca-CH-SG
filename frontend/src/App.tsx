import { useState } from 'react'
import { client as standardClient, type Client } from './api/client'
import type { Fixture } from './api/fixtures'
import { baueGesuche, mitAllenAusgaben, periodeVon } from './api/situation'
import { LEERER_ZWISCHENSTAND, type Zwischenstand } from './api/zwischenstand'
import { DEMO_GESUCHSDATUM, API_MODUS } from './konfiguration'
import { RechtsstandBanner } from './komponenten/RechtsstandBanner'
import { Ergebnis, type Anfrage } from './screens/Ergebnis'
import { Fragebogen } from './screens/Fragebogen'
import { bereinige } from './screens/fragen'
import { Start } from './screens/Start'
import { Warum } from './screens/Warum'
import { texte } from './texte/de'
import { STANDARD_PERIODE, type Situation } from './vertrag'
import { familieMeier } from './zustand/beispiele'
import { leeresFormular, leeresKind, type Formular } from './zustand/formular'

type Ansicht =
  | { art: 'start' }
  | { art: 'fragebogen'; frage?: string }
  | { art: 'ergebnis'; anfragen: Anfrage[]; ausFormular: boolean }
  | { art: 'warum'; anfrage: Anfrage; zurueck: { anfragen: Anfrage[]; ausFormular: boolean } }

const heute = () => new Date().toISOString().slice(0, 10)
const gesuchsdatum = () => (API_MODUS === 'fixtures' ? DEMO_GESUCHSDATUM : heute())
const neuesFormular = () => leeresFormular(gesuchsdatum())

/** Vorführung per Link: ?demo=meier (Fragebogen) oder ?demo=meier-ergebnis (direkt das Ergebnis). */
const demoAusLink = () => new URLSearchParams(window.location.search).get('demo')

function anfragenAus(f: Formular, stand: Zwischenstand): Anfrage[] {
  const bereinigt = bereinige(f, stand)
  return baueGesuche(bereinigt, undefined, undefined, stand.partnerGefestigt).map(
    (g): Anfrage => ({ situation: g.situation, periode: g.periode, quelle: 'formular', namen: g.namen }),
  )
}

export default function App({ client = standardClient }: { client?: Client }) {
  const [formular, setFormular] = useState<Formular>(() => (demoAusLink()?.startsWith('meier') ? familieMeier(gesuchsdatum()) : neuesFormular()))
  const [ansicht, setAnsicht] = useState<Ansicht>(() => {
    const demo = demoAusLink()
    if (demo === 'meier') return { art: 'fragebogen' }
    if (demo === 'meier-ergebnis') return { art: 'ergebnis', anfragen: anfragenAus(familieMeier(gesuchsdatum()), LEERER_ZWISCHENSTAND), ausFormular: true }
    return { art: 'start' }
  })
  const [stand, setStand] = useState<Zwischenstand>(LEERER_ZWISCHENSTAND)

  const zeige = (a: Ansicht) => {
    setAnsicht(a)
    window.scrollTo?.(0, 0)
  }

  const berechne = (f: Formular) => {
    const bereinigt = bereinige(f, stand)
    setFormular(bereinigt)
    zeige({ art: 'ergebnis', anfragen: anfragenAus(bereinigt, stand), ausFormular: true })
  }

  const beispiel = (direktZumErgebnis: boolean) => {
    const f = familieMeier(gesuchsdatum())
    setFormular(f)
    setStand(LEERER_ZWISCHENSTAND)
    if (direktZumErgebnis) zeige({ art: 'ergebnis', anfragen: anfragenAus(f, LEERER_ZWISCHENSTAND), ausFormular: true })
    else zeige({ art: 'fragebogen', frage: 'start-beispiel' })
  }

  const weiteresKind = () => {
    const f = { ...formular, kinder: [...formular.kinder, leeresKind()] }
    setFormular(f)
    zeige({ art: 'fragebogen', frage: `k${f.kinder.length - 1}_geburt` })
  }

  const demo = (fixture: Fixture) => {
    const periode = periodeVon(fixture.request as Situation) ?? STANDARD_PERIODE
    const situation = mitAllenAusgaben(fixture.request as Situation, periode)
    zeige({ art: 'ergebnis', anfragen: [{ situation, periode, quelle: 'demo' }], ausFormular: false })
  }

  const neu = () => {
    setFormular(neuesFormular())
    setStand(LEERER_ZWISCHENSTAND)
    zeige({ art: 'start' })
  }

  return (
    <>
      <header className="kopf">
        <div className="kopf__inhalt">
          <h1>{texte.app.titel}</h1>
          <p className="modus">{API_MODUS === 'fixtures' ? texte.app.modusFixtures : texte.app.modusLive}</p>
        </div>
        <RechtsstandBanner />
      </header>
      <main>
        {ansicht.art === 'start' && <Start onStarten={() => zeige({ art: 'fragebogen' })} onDemo={demo} onBeispiel={beispiel} />}
        {ansicht.art === 'fragebogen' && (
          <Fragebogen
            key={ansicht.frage ?? 'anfang'}
            formular={formular}
            setFormular={setFormular}
            stand={stand}
            setStand={setStand}
            client={client}
            startFrage={ansicht.frage}
            onBerechnen={berechne}
            onAbbrechen={() => zeige({ art: 'start' })}
            onNeu={neu}
          />
        )}
        {ansicht.art === 'ergebnis' && (
          <Ergebnis
            key={JSON.stringify(ansicht.anfragen.map((a) => a.situation))}
            anfragen={ansicht.anfragen}
            client={client}
            formular={ansicht.ausFormular ? formular : undefined}
            onWarum={(anfrage) => zeige({ art: 'warum', anfrage, zurueck: ansicht })}
            onZurFrage={(frage) => zeige({ art: 'fragebogen', frage })}
            onAendern={() => zeige({ art: 'fragebogen' })}
            onNeu={neu}
            onWeiteresKind={ansicht.ausFormular ? weiteresKind : undefined}
            onGenauer={berechne}
          />
        )}
        {ansicht.art === 'warum' && (
          <Warum
            anfrage={ansicht.anfrage}
            client={client}
            onZurueck={() => zeige({ art: 'ergebnis', ...ansicht.zurueck })}
          />
        )}
      </main>
      <footer className="fuss">
        <p>{texte.fusszeile.datenschutz}</p>
      </footer>
    </>
  )
}
