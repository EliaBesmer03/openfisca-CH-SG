import type { Fixture } from '../api/fixtures'
import { DemoLeiste } from '../komponenten/DemoLeiste'
import { texte } from '../texte/de'

type Props = {
  onStarten: () => void
  onDemo: (f: Fixture) => void
  /** Familie Meier: vorausgefüllter Fragebogen bzw. direkt das Ergebnis */
  onBeispiel: (direktZumErgebnis: boolean) => void
}

export function Start({ onStarten, onDemo, onBeispiel }: Props) {
  const b = texte.start.beispiel
  return (
    <div className="start">
      <section className="karte">
        <p className="einleitung">{texte.app.zweck}</p>
        <button type="button" className="knopf knopf--gross" onClick={onStarten}>
          {texte.start.starten}
        </button>
      </section>
      <section className="karte beispiel" aria-labelledby="beispiel-titel">
        <h2 id="beispiel-titel">{b.titel}</h2>
        <p>{b.text}</p>
        <div className="navigation">
          <button type="button" className="knopf" onClick={() => onBeispiel(false)}>
            {b.fragebogen}
          </button>
          <button type="button" className="knopf knopf--sekundaer" onClick={() => onBeispiel(true)}>
            {b.ergebnis}
          </button>
        </div>
      </section>
      <DemoLeiste onWaehle={onDemo} />
    </div>
  )
}
