/** Gemeindeentscheid über die Ausnahme vom Mindestpensum: Schätzung und Simulation von Bewilligung und Ablehnung. */
import { useState } from 'react'
import type { Ergebnis as ErgebnisDaten } from '../../api/antwort'
import type { Client } from '../../api/client'
import { familienEingabe, mitEntscheid } from '../../api/situation'
import { StatusKarte } from '../../komponenten/StatusKarte'
import { texte } from '../../texte/de'
import { chf, personName } from '../../texte/format'
import { Ausnahmegrund, Entscheid, V } from '../../vertrag'
import { Betrag } from './Betraege'
import { useBerechnung, type Anfrage, type Laden, type Namen } from './berechnung'

function KurzErgebnis({ titel, stand, namen }: { titel: string; stand: Laden<ErgebnisDaten> | null; namen: Namen }) {
  return (
    <div className="simulation__fall">
      <h4>{titel}</h4>
      {stand?.zustand === 'laedt' && <p aria-live="polite">{texte.ergebnis.laedt}</p>}
      {stand?.zustand === 'fehler' && <p role="alert">{stand.text}</p>}
      {stand?.zustand === 'ok' && (
        <StatusKarte status={stand.daten.status} kompakt>
          <ul>
            {stand.daten.kinder.map((k) => (
              <li key={k.id}>
                {personName(k.id, namen)}: <Betrag n={k.beitragTotal} />
              </li>
            ))}
          </ul>
        </StatusKarte>
      )}
    </div>
  )
}

export function Pruefung({ e, anfrage, client }: { e: ErgebnisDaten; anfrage: Anfrage; client: Client }) {
  const t = texte.ergebnis.pruefung
  const [fall, setFall] = useState<{ bewilligt: Anfrage | null; abgelehnt: Anfrage | null }>({ bewilligt: null, abgelehnt: null })
  const bewilligt = useBerechnung(client, fall.bewilligt)
  const abgelehnt = useBerechnung(client, fall.abgelehnt)
  const simuliere = (entscheid: Entscheid) => ({
    ...anfrage,
    situation: mitEntscheid(anfrage.situation, anfrage.periode, entscheid),
  })

  const grund = familienEingabe(anfrage.situation, V.ausnahmegrund, anfrage.periode)
  const grundText =
    typeof grund === 'string' && grund !== Ausnahmegrund.KEINER && grund in texte.optionen.ausnahmegrund
      ? texte.optionen.ausnahmegrund[grund as Ausnahmegrund]
      : null

  return (
    <section className="karte pruefung">
      <h3>{t.titel}</h3>
      <p>{t.text}</p>
      {grundText && <p>{t.grund(grundText)}</p>}
      {e.kinder
        .filter((k) => k.schaetzungFallsBewilligt !== null)
        .map((k) => (
          <p key={k.id}>{t.schaetzung(personName(k.id, anfrage.namen), chf(k.schaetzungFallsBewilligt!))}</p>
        ))}
      <div className="navigation">
        <button type="button" className="knopf" onClick={() => setFall((f) => ({ ...f, bewilligt: simuliere(Entscheid.BEWILLIGT) }))}>
          {t.bewilligt}
        </button>
        <button type="button" className="knopf knopf--sekundaer" onClick={() => setFall((f) => ({ ...f, abgelehnt: simuliere(Entscheid.ABGELEHNT) }))}>
          {t.abgelehnt}
        </button>
      </div>
      {(fall.bewilligt || fall.abgelehnt) && (
        <div className="simulation">
          {fall.bewilligt && <KurzErgebnis titel={t.fallBewilligt} stand={bewilligt} namen={anfrage.namen} />}
          {fall.abgelehnt && <KurzErgebnis titel={t.fallAbgelehnt} stand={abgelehnt} namen={anfrage.namen} />}
        </div>
      )}
      <p className="leitsatz">{t.leitsatz}</p>
    </section>
  )
}
