/**
 * Ergebnis: ein Abschnitt pro Gesuchseinheit (siehe ergebnis/GesuchErgebnis); bei mehreren Gesuchen
 * (Patchwork) die Summe. Alle Werte kommen von der API; das Frontend addiert nur die Beträge der Gesuche.
 */
import { useState } from 'react'
import type { Client } from '../api/client'
import { texte } from '../texte/de'
import { chfRund } from '../texte/format'
import type { Formular } from '../zustand/formular'
import { GenauerRechnen } from './ergebnis/GenauerRechnen'
import { GesuchErgebnis } from './ergebnis/GesuchErgebnis'
import { gemeindeVon, useBerechnungen, type Anfrage } from './ergebnis/berechnung'

export type { Anfrage } from './ergebnis/berechnung'

type Props = {
  anfragen: readonly Anfrage[]
  client: Client
  /** Nur bei Ergebnissen aus dem Fragebogen */
  formular?: Formular
  onWarum: (anfrage: Anfrage) => void
  onZurFrage: (schluessel: string) => void
  onAendern: () => void
  onNeu: () => void
  onWeiteresKind?: () => void
  onGenauer?: (f: Formular) => void
}

export function Ergebnis({ anfragen, client, formular, onWarum, onZurFrage, onAendern, onNeu, onWeiteresKind, onGenauer }: Props) {
  const t = texte.ergebnis
  const [versuch, setVersuch] = useState(0)
  const staende = useBerechnungen(client, anfragen, versuch)
  const ausFormular = formular !== undefined

  if (staende.some((s) => s.zustand === 'laedt')) {
    return (
      <p className="laedt" role="status" aria-busy="true">
        {t.laedt}
      </p>
    )
  }
  const fehler = staende.find((s) => s.zustand === 'fehler')
  if (fehler?.zustand === 'fehler') {
    return (
      <section className="karte" role="alert">
        <h2>{texte.fehler.titel}</h2>
        <p>{fehler.text}</p>
        <div className="navigation">
          <button type="button" className="knopf" onClick={() => setVersuch(versuch + 1)}>
            {texte.fehler.erneut}
          </button>
          {ausFormular && (
            <button type="button" className="knopf knopf--sekundaer" onClick={onAendern}>
              {texte.navigation.zumFragebogen}
            </button>
          )}
        </div>
      </section>
    )
  }

  const ergebnisse = staende.flatMap((s) => (s.zustand === 'ok' ? [s.daten] : []))
  const mehrere = ergebnisse.length > 1
  const summe = ergebnisse.reduce((n, e) => n + (e.familie.beitragTotal ?? 0), 0)
  const erstes = ergebnisse[0]
  const gemeinde = erstes ? gemeindeVon(erstes, anfragen[0]) : null

  return (
    <div className="ergebnis">
      <h2>{t.titel}</h2>
      {mehrere && (
        <>
          {summe > 0 && <p className="satz">{t.gesamt(chfRund(summe))}</p>}
          <p className="hinweis">{t.gesuchHinweis}</p>
        </>
      )}
      {ergebnisse.map((e, i) => (
        <GesuchErgebnis
          key={i}
          e={e}
          anfrage={anfragen[i]}
          client={client}
          mehrere={mehrere}
          onWarum={() => onWarum(anfragen[i])}
          onZurFrage={ausFormular ? onZurFrage : undefined}
        />
      ))}
      <p className="hinweis">
        {t.entwurfHinweis} {t.annahmeWochen}
      </p>
      {erstes?.zusatzbeitragPlatzhalter && (
        <p className="hinweis">{gemeinde ? t.platzhalter(gemeinde) : texte.flags.flag_zusatzbeitrag_platzhalter}</p>
      )}

      {formular && onGenauer && <GenauerRechnen formular={formular} onAnwenden={onGenauer} />}

      <div className="navigation">
        {onWeiteresKind && (
          <button type="button" className="knopf" onClick={onWeiteresKind}>
            {t.weiteresKind}
          </button>
        )}
        {ausFormular && (
          <button type="button" className="knopf knopf--sekundaer" onClick={onAendern}>
            {texte.navigation.zumFragebogen}
          </button>
        )}
        <button type="button" className="knopf knopf--sekundaer" onClick={onNeu}>
          {texte.navigation.neu}
        </button>
      </div>

      <footer className="ergebnis__fuss">
        {gemeinde && <p>{t.zustaendig(gemeinde)}</p>}
        <p>{t.verfuegung}</p>
        <p>{t.auszahlung}</p>
      </footer>
    </div>
  )
}
