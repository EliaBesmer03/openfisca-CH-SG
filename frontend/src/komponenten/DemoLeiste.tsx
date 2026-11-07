/** Demo-Familien aus contract/fixtures: F1, F2, F9 sichtbar, Rest unter „Weitere Fälle“. */
import { FIXTURES, type Fixture } from '../api/fixtures'
import { texte } from '../texte/de'

const SICHTBAR = /^F0?(1|2|9)_/

export function DemoLeiste({ onWaehle }: { onWaehle: (f: Fixture) => void }) {
  const t = texte.start
  if (FIXTURES.length === 0) return <p>{t.keineDemos}</p>
  const sichtbar = FIXTURES.filter((f) => SICHTBAR.test(f.id))
  const weitere = FIXTURES.filter((f) => !SICHTBAR.test(f.id))
  const knopf = (f: Fixture) => (
    <li key={f.id}>
      <button type="button" className="knopf knopf--sekundaer" onClick={() => onWaehle(f)}>
        {t.demoName(f.id)}
      </button>
    </li>
  )
  return (
    <section className="demo" aria-labelledby="demo-titel">
      <h2 id="demo-titel">{t.demoTitel}</h2>
      <p className="hilfe">{t.demoHinweis}</p>
      <ul className="demo__liste">{sichtbar.map(knopf)}</ul>
      {weitere.length > 0 && (
        <details>
          <summary>{t.weitereFaelle}</summary>
          <ul className="demo__liste">{weitere.map(knopf)}</ul>
        </details>
      )}
    </section>
  )
}
