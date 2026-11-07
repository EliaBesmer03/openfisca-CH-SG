import { useState } from 'react'
import type { Client } from '../api/client'
import { pruefeZwischenstand, type Zwischenstand } from '../api/zwischenstand'
import { FrageKarte } from '../komponenten/FrageKarte'
import { StatusKarte } from '../komponenten/StatusKarte'
import { texte } from '../texte/de'
import { fehlerText } from '../texte/fehler'
import { Pruefstatus, type FlagName } from '../vertrag'
import type { Formular } from '../zustand/formular'
import { fragenFuer, kindName, type Aendere, type FrageDef } from './fragen'

type Props = {
  formular: Formular
  setFormular: (f: Formular) => void
  stand: Zwischenstand
  setStand: (s: Zwischenstand) => void
  client: Client
  startFrage?: string
  onBerechnen: (f: Formular) => void
  onAbbrechen: () => void
  onNeu: () => void
}

type Abbruch = { flag: FlagName; kind?: number }

/** Flag der eben beantworteten Frage, das den Fragebogen beendet (laut Modell). */
function abbruchNach(frage: FrageDef, stand: Zwischenstand): Abbruch | null {
  if (!frage.abbruch) return null
  const { flags, kind } = frage.abbruch
  const gesetzt = kind === undefined ? Object.values(stand.familienFlags).flat() : (stand.kindFlags[kind] ?? [])
  const flag = flags.find((f) => gesetzt.includes(f))
  return flag ? { flag, kind } : null
}

export function Fragebogen({ formular, setFormular, stand, setStand, client, startFrage, onBerechnen, onAbbrechen, onNeu }: Props) {
  const fragen = fragenFuer(formular, stand)
  const [index, setIndex] = useState(() => Math.max(0, fragen.findIndex((f) => f.schluessel === startFrage)))
  const [zeigeFehler, setZeigeFehler] = useState(false)
  const [prueft, setPrueft] = useState(false)
  const [abbruch, setAbbruch] = useState<Abbruch | null>(null)
  const [pruefFehler, setPruefFehler] = useState<string | null>(null)

  const aktuell = fragen[Math.min(index, fragen.length - 1)]
  const vollstaendig = aktuell.vollstaendig(formular)

  const aendere: Aendere = (aenderung) => {
    const entwurf = structuredClone(formular)
    aenderung(entwurf)
    setFormular(entwurf)
  }

  const weiter = async () => {
    if (!vollstaendig) {
      setZeigeFehler(true)
      return
    }
    setZeigeFehler(false)
    setPruefFehler(null)
    let neu = stand
    if (aktuell.pruefen) {
      setPrueft(true)
      try {
        neu = await pruefeZwischenstand(client, formular)
        setStand(neu)
      } catch (e) {
        // Live: ohne Antwort des Modells nicht raten, welche Fragen nötig sind.
        // Demo-Modus (Fixtures): Zwischenprüfung nicht möglich, ohne sie weiter.
        if (client.modus === 'live') {
          setPruefFehler(fehlerText(e))
          return
        }
      } finally {
        setPrueft(false)
      }
      const ende = abbruchNach(aktuell, neu)
      if (ende) {
        setAbbruch(ende)
        return
      }
    }
    // Die Fragenliste kann sich durch die Antwort ändern; weiter nach der aktuellen Frage.
    const liste = fragenFuer(formular, neu)
    const pos = liste.findIndex((f) => f.schluessel === aktuell.schluessel)
    if (pos === -1 || pos >= liste.length - 1) onBerechnen(formular)
    else setIndex(pos + 1)
  }

  if (abbruch) {
    const name = abbruch.kind === undefined ? null : (kindName(formular, abbruch.kind) ?? null)
    const weitereKinder = abbruch.kind !== undefined && abbruch.kind > 0
    return (
      <section className="karte" aria-labelledby="abbruch-titel">
        <h2 id="abbruch-titel">{texte.abbruch.titel}</h2>
        <p className="satz">{texte.abbruch.satz(name)}</p>
        <StatusKarte status={Pruefstatus.KEIN_ANSPRUCH}>
          <p>{texte.flags[abbruch.flag]}</p>
        </StatusKarte>
        <div className="navigation">
          <button type="button" className="knopf knopf--sekundaer" onClick={() => setAbbruch(null)}>
            {texte.abbruch.aendern}
          </button>
          {weitereKinder ? (
            <button
              type="button"
              className="knopf"
              onClick={() => onBerechnen({ ...formular, kinder: formular.kinder.filter((_, i) => i !== abbruch.kind) })}
            >
              {texte.abbruch.ohneKind(name ?? texte.personen.kind(abbruch.kind! + 1))}
            </button>
          ) : (
            <button type="button" className="knopf" onClick={onNeu}>
              {texte.navigation.neu}
            </button>
          )}
        </div>
      </section>
    )
  }

  const letzte = index >= fragen.length - 1
  return (
    <form
      className="fragebogen"
      onSubmit={(e) => {
        e.preventDefault()
        void weiter()
      }}
      noValidate
    >
      <FrageKarte titel={aktuell.titel} hilfe={aktuell.hilfe} nummer={index + 1} gesamt={fragen.length}>
        {aktuell.inhalt(formular, aendere)}
      </FrageKarte>
      {pruefFehler && (
        <p className="fehlermeldung" role="alert">
          {pruefFehler}
        </p>
      )}
      {zeigeFehler && !vollstaendig && (
        <p className="fehlermeldung" role="alert">
          {texte.navigation.ungueltig}
        </p>
      )}
      <div className="navigation">
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => (index === 0 ? onAbbrechen() : (setZeigeFehler(false), setIndex(index - 1)))}
        >
          {index === 0 ? texte.navigation.abbrechen : texte.navigation.zurueck}
        </button>
        <button type="submit" className="knopf" disabled={prueft}>
          {letzte ? texte.navigation.berechnen : texte.navigation.weiter}
        </button>
      </div>
    </form>
  )
}
