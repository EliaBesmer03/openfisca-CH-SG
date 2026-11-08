/** Alle Testfälle aus contract/fixtures, klein und eingeklappt am Ende der Startseite. */
import { FIXTURES, type Fixture } from '../api/fixtures'
import { texte } from '../texte/de'

export function DemoLeiste({ onWaehle }: { onWaehle: (f: Fixture) => void }) {
  const t = texte.start
  if (FIXTURES.length === 0) return null
  return (
    <details className="testfaelle">
      <summary>{t.testfaelle(FIXTURES.length)}</summary>
      <p className="hilfe">{t.demoHinweis}</p>
      <ul className="testfaelle__liste">
        {FIXTURES.map((f) => (
          <li key={f.id}>
            <button type="button" className="link" onClick={() => onWaehle(f)}>
              {t.demoName(f.id)}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
