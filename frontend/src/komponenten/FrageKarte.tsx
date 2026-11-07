import { useEffect, useRef, type ReactNode } from 'react'
import { texte } from '../texte/de'

type Props = {
  titel: string
  hilfe?: string
  nummer: number
  gesamt: number
  children: ReactNode
}

/** Eine Frage pro Karte. */
export function FrageKarte({ titel, hilfe, nummer, gesamt, children }: Props) {
  const ueberschrift = useRef<HTMLHeadingElement>(null)
  // Fokus auf die neue Frage, damit Tastatur- und Screenreader-Nutzende folgen können.
  useEffect(() => {
    ueberschrift.current?.focus()
  }, [titel])

  return (
    <section className="karte frage" aria-labelledby="frage-titel">
      <p className="fortschritt">
        {texte.navigation.fortschritt(nummer, gesamt)}
        <progress max={gesamt} value={nummer} aria-hidden="true" />
      </p>
      <h2 id="frage-titel" ref={ueberschrift} tabIndex={-1}>
        {titel}
      </h2>
      {hilfe && <p className="hilfe">{hilfe}</p>}
      <div className="frage__felder">{children}</div>
    </section>
  )
}
