import { useState } from 'react'
import { DatumFeld, WeissNichtFeld, ZahlFeld } from '../../komponenten/Felder'
import { texte } from '../../texte/de'
import type { Formular } from '../../zustand/formular'
import { kindName } from '../fragen'

/** Seltene Angaben nach dem Ergebnis: Betreuungsbeginn, Gesuchsdatum, Einkommensrückgang, Zusatzbeitrag. */
export function GenauerRechnen({ formular, onAnwenden }: { formular: Formular; onAnwenden: (f: Formular) => void }) {
  const t = texte.ergebnis.genauer
  const [entwurf, setEntwurf] = useState(formular)
  const aendere = (aenderung: (f: Formular) => void) => {
    const neu = structuredClone(entwurf)
    aenderung(neu)
    setEntwurf(neu)
  }
  return (
    <details className="genauer">
      <summary>{t.titel}</summary>
      <p className="hilfe">{t.hilfe}</p>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          onAnwenden(entwurf)
        }}
      >
        {entwurf.kinder.map((k, i) => (
          <DatumFeld
            key={i}
            label={t.beginn(kindName(entwurf, i) ?? texte.personen.kind(i + 1))}
            wert={k.betreuungsbeginn}
            onChange={(w) => aendere((f) => void (f.kinder[i].betreuungsbeginn = w))}
          />
        ))}
        <DatumFeld label={t.gesuch} wert={entwurf.gesuchsdatum} onChange={(w) => aendere((f) => void (f.gesuchsdatum = w))} />
        <WeissNichtFeld label={t.gesunken} wert={entwurf.einkommenGesunken} onChange={(w) => aendere((f) => void (f.einkommenGesunken = w))} />
        {entwurf.einkommenGesunken && (
          <ZahlFeld label={t.aktuell} einheit={texte.einheiten.chf} min={0} schritt={100} wert={entwurf.meAktuell} onChange={(w) => aendere((f) => void (f.meAktuell = w))} />
        )}
        <details className="experten">
          <summary>{t.experten}</summary>
          <p className="hilfe">{t.expertenHilfe}</p>
          <ZahlFeld
            label={t.z1}
            einheit={texte.einheiten.chfProStunde}
            min={0}
            schritt={0.05}
            wert={entwurf.zusatzbeitragZ1 ?? Number.NaN}
            onChange={(w) => aendere((f) => void (f.zusatzbeitragZ1 = Number.isFinite(w) ? w : null))}
          />
          <ZahlFeld
            label={t.z2}
            einheit={texte.einheiten.chfProStunde}
            min={0}
            schritt={0.05}
            wert={entwurf.zusatzbeitragZ2 ?? Number.NaN}
            onChange={(w) => aendere((f) => void (f.zusatzbeitragZ2 = Number.isFinite(w) ? w : null))}
          />
        </details>
        <button type="submit" className="knopf knopf--sekundaer">
          {t.neuRechnen}
        </button>
      </form>
    </details>
  )
}
