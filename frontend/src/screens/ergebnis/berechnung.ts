/** Anfragen ans Modell für die Ergebnisseite: Typen, Lade-Hooks und gemeinsame Hilfen. */
import { useEffect, useState } from 'react'
import type { Ergebnis as ErgebnisDaten } from '../../api/antwort'
import type { Client } from '../../api/client'
import { familienEingabe } from '../../api/situation'
import { fehlerText } from '../../texte/fehler'
import { V, gemeindeName, istSonderwert, type Situation } from '../../vertrag'

export type Anfrage = {
  situation: Situation
  periode: string
  /** Formular: „Zur Frage“-Links möglich; Demo: Situation stammt aus einem Fixture. */
  quelle: 'formular' | 'demo'
  /** Anzeigenamen der Kinder nach Personen-ID */
  namen?: Record<string, string>
}

export type Namen = Readonly<Record<string, string>> | undefined
/** Position im Formular aus der Personen-ID `kind_3` → 2. */
export const kindIndex = (id: string) => {
  const nr = /^kind_(\d+)$/.exec(id)
  return nr ? Number(nr[1]) - 1 : undefined
}

export type Laden<T> = { zustand: 'laedt' } | { zustand: 'fehler'; text: string } | { zustand: 'ok'; daten: T }


/** Sendet die Anfrage; „lädt“, solange keine Antwort zu genau dieser Anfrage und diesem Versuch vorliegt. */
export function useBerechnung(client: Client, anfrage: Anfrage | null, versuch = 0): Laden<ErgebnisDaten> | null {
  type Antwort = { anfrage: Anfrage; versuch: number; ergebnis: Laden<ErgebnisDaten> }
  const [antwort, setAntwort] = useState<Antwort | null>(null)
  useEffect(() => {
    if (!anfrage) return
    let aktiv = true
    const fertig = (ergebnis: Laden<ErgebnisDaten>) => aktiv && setAntwort({ anfrage, versuch, ergebnis })
    client
      .berechne(anfrage.situation, anfrage.periode)
      .then((daten) => fertig({ zustand: 'ok', daten }))
      .catch((e: unknown) => fertig({ zustand: 'fehler', text: fehlerText(e) }))
    return () => {
      aktiv = false
    }
  }, [client, anfrage, versuch])
  if (!anfrage) return null
  if (!antwort || antwort.anfrage !== anfrage || antwort.versuch !== versuch) return { zustand: 'laedt' }
  return antwort.ergebnis
}

/** Mehrere Anfragen parallel; Reihenfolge wie `anfragen`. */
export function useBerechnungen(client: Client, anfragen: readonly Anfrage[], versuch: number): Laden<ErgebnisDaten>[] {
  type Antwort = { anfragen: readonly Anfrage[]; versuch: number; ergebnisse: Laden<ErgebnisDaten>[] }
  const [antwort, setAntwort] = useState<Antwort | null>(null)
  useEffect(() => {
    let aktiv = true
    const ergebnisse: Laden<ErgebnisDaten>[] = anfragen.map(() => ({ zustand: 'laedt' }))
    anfragen.forEach((a, i) => {
      client
        .berechne(a.situation, a.periode)
        .then(
          (daten): Laden<ErgebnisDaten> => ({ zustand: 'ok', daten }),
          (e: unknown): Laden<ErgebnisDaten> => ({ zustand: 'fehler', text: fehlerText(e) }),
        )
        .then((r) => {
          if (!aktiv) return
          ergebnisse[i] = r
          setAntwort({ anfragen, versuch, ergebnisse: [...ergebnisse] })
        })
    })
    return () => {
      aktiv = false
    }
  }, [client, anfragen, versuch])
  if (!antwort || antwort.anfragen !== anfragen || antwort.versuch !== versuch) return anfragen.map(() => ({ zustand: 'laedt' }))
  return antwort.ergebnisse
}

export function gemeindeVon(e: ErgebnisDaten, anfrage: Anfrage): string | null {
  const schluessel = e.familie.wohngemeinde ?? familienEingabe(anfrage.situation, V.wohngemeinde, anfrage.periode)
  return typeof schluessel === 'string' && !istSonderwert(schluessel) ? gemeindeName(schluessel) : null
}
