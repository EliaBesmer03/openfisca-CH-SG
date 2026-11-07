/** Wohngemeinde: Suche über die 75 Gemeinden aus contract/gemeinden.json, gruppiert nach Wahlkreis. */
import { useId, useMemo, useState } from 'react'
import { texte } from '../texte/de'
import { GEMEINDEN, GEMEINDEN_GELADEN, WohngemeindeSonderwert, gemeindeName, istSonderwert } from '../vertrag'

type Props = { wert: string; onChange: (schluessel: string) => void }

/** Für die Suche: „St.Gallen“ = „St. Gallen“, „Haggenschwil“ = „Häggenschwil“. */
const suchform = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[\s.\-']/g, '')

export function GemeindeAuswahl({ wert, onChange }: Props) {
  const t = texte.fragen.wohngemeinde
  const sucheId = useId()
  const listeId = useId()
  const [suche, setSuche] = useState('')

  const gruppen = useMemo(() => {
    const treffer = GEMEINDEN.filter((g) => suchform(g.name).includes(suchform(suche)))
    const nachKreis = new Map<string, typeof treffer>()
    for (const g of treffer) {
      const kreis = g.wahlkreis ?? ''
      nachKreis.set(kreis, [...(nachKreis.get(kreis) ?? []), g])
    }
    return [...nachKreis].sort(([a], [b]) => a.localeCompare(b))
  }, [suche])

  const sonder = (
    <div className="gemeinde__sonder">
      <label className="auswahl__option">
        <input
          type="radio"
          name={listeId}
          checked={wert === WohngemeindeSonderwert.AUSSERKANTONAL}
          onChange={() => onChange(WohngemeindeSonderwert.AUSSERKANTONAL)}
        />
        <span>{t.ausserhalb}</span>
      </label>
      <label className="auswahl__option">
        <input
          type="radio"
          name={listeId}
          checked={wert === WohngemeindeSonderwert.UNBEKANNT}
          onChange={() => onChange(WohngemeindeSonderwert.UNBEKANNT)}
        />
        <span>{texte.frage.weissNicht}</span>
      </label>
    </div>
  )

  if (!GEMEINDEN_GELADEN) {
    return (
      <div className="gemeinde">
        <p className="hinweis">{t.listeFehlt}</p>
        <div className="feld">
          <label htmlFor={sucheId}>{t.schluessel}</label>
          <input
            id={sucheId}
            value={istSonderwert(wert) ? '' : wert}
            onChange={(e) => onChange(e.target.value.trim().toUpperCase() || WohngemeindeSonderwert.UNBEKANNT)}
          />
        </div>
        {sonder}
      </div>
    )
  }

  return (
    <div className="gemeinde">
      <div className="feld">
        <label htmlFor={sucheId}>{t.suchen}</label>
        <input id={sucheId} type="search" value={suche} onChange={(e) => setSuche(e.target.value)} />
      </div>
      <div className="feld">
        <label htmlFor={listeId}>{t.auswahl}</label>
        <select
          id={listeId}
          size={8}
          value={istSonderwert(wert) ? '' : wert}
          onChange={(e) => onChange(e.target.value || WohngemeindeSonderwert.UNBEKANNT)}
        >
          {/* Leere Option: Ohne sie zeigt der Browser die erste Gemeinde als gewählt an,
              obwohl keine gewählt ist – und genau diese lässt sich dann nicht mehr anwählen. */}
          <option value="">{t.bitteWaehlen}</option>
          {gruppen.map(([kreis, liste]) => (
            <optgroup key={kreis} label={kreis}>
              {liste.map((g) => (
                <option key={g.schluessel} value={g.schluessel}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {!istSonderwert(wert) && <p aria-live="polite">{t.gewaehlt(gemeindeName(wert))}</p>}
      {sonder}
    </div>
  )
}
