import type { Fixture } from '../api/fixtures'
import { DemoLeiste } from '../komponenten/DemoLeiste'
import { RegelId } from '../komponenten/NormZitat'
import { texte } from '../texte/de'
import { REGEL } from '../vertrag'

export function Start({ onStarten, onDemo }: { onStarten: () => void; onDemo: (f: Fixture) => void }) {
  return (
    <div className="start">
      <section className="karte">
        <p className="einleitung">
          {texte.app.zweck} <RegelId id={REGEL.zweck} />
        </p>
        <button type="button" className="knopf knopf--gross" onClick={onStarten}>
          {texte.start.starten}
        </button>
      </section>
      <DemoLeiste onWaehle={onDemo} />
    </div>
  )
}
