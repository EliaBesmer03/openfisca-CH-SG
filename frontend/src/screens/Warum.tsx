/**
 * Warum-Ansicht (PLAN B8/B9): Rechtsschicht in Prüfreihenfolge mit Originalwortlaut,
 * Rechnung nach dem Anhang KiBV mit Werten aus dem Trace, Anwendungsschicht (Status, Flags),
 * technische Ansicht mit dem rohen Trace.
 */
import { useEffect, useState } from 'react'
import type { Client } from '../api/client'
import { erklaere, istPruefstatus, type Erklaerung } from '../api/trace'
import { RegelId } from '../komponenten/NormZitat'
import { RegelZeile } from '../komponenten/RegelZeile'
import { StatusKarte, StatusMarke } from '../komponenten/StatusKarte'
import { texte } from '../texte/de'
import { personName, rechnungZeilen } from '../texte/format'
import { ENTITAET_PLURAL, FLAGS, PRUEF_REGEL, Pruefstatus, REGEL, ROLLE } from '../vertrag'
import { fehlerText } from '../texte/fehler'
import type { Anfrage } from './Ergebnis'

type Stand =
  | { anfrage: Anfrage; zustand: 'ok'; erklaerung: Erklaerung; roh: unknown }
  | { anfrage: Anfrage; zustand: 'fehler'; text: string }

function kinderAus(anfrage: Anfrage): string[] {
  const familie = Object.values(anfrage.situation[ENTITAET_PLURAL.familie])[0]
  const kinder = familie?.[ROLLE.kinder]
  return Array.isArray(kinder) ? kinder : []
}

export function Warum({ anfrage, client, onZurueck }: { anfrage: Anfrage; client: Client; onZurueck: () => void }) {
  const t = texte.warum
  const [stand, setStand] = useState<Stand | null>(null)

  useEffect(() => {
    let aktiv = true
    client
      .trace(anfrage.situation)
      .then((roh) => {
        const erklaerung = erklaere(roh, anfrage.periode, kinderAus(anfrage))
        if (aktiv) setStand({ anfrage, zustand: 'ok', erklaerung, roh })
      })
      .catch((e: unknown) => aktiv && setStand({ anfrage, zustand: 'fehler', text: fehlerText(e) }))
    return () => {
      aktiv = false
    }
  }, [client, anfrage])

  const zurueck = (
    <button type="button" className="knopf knopf--sekundaer" onClick={onZurueck}>
      {t.zurueck}
    </button>
  )

  if (!stand || stand.anfrage !== anfrage) return <p aria-live="polite">{t.laedt}</p>
  if (stand.zustand === 'fehler') {
    return (
      <section className="karte" role="alert">
        <h2>{t.titel}</h2>
        <p>{stand.text}</p>
        {zurueck}
      </section>
    )
  }

  const e = stand.erklaerung
  const mehrereKinder = e.rechnungen.length > 1
  // Vor Vollzugsbeginn liefert das Modell nur Standardwerte; Regelzeilen wären irreführend.
  const nichtInKraft = e.anwendung.status === Pruefstatus.NICHT_IN_KRAFT

  return (
    <div className="warum-ansicht">
      <h2>{t.titel}</h2>
      <div className="navigation">{zurueck}</div>

      <section aria-labelledby="recht-titel">
        <h3 id="recht-titel">{t.rechtsschicht}</h3>
        {nichtInKraft ? (
          <p className="karte">
            {t.nichtInKraft} <RegelId id={REGEL.vollzugsbeginn} />
          </p>
        ) : (
          <>
            <p className="hilfe">{t.rechtsschichtHilfe}</p>
            {e.schritte.map((s) => (
              <section key={s.schritt} className="karte schritt" aria-labelledby={`schritt-${s.schritt}`}>
                <h4 id={`schritt-${s.schritt}`}>{t.schritte[s.schritt]}</h4>
                <ul className="regelliste">
                  {s.zeilen.map((z, i) => (
                    <RegelZeile key={`${z.regelId}-${z.kind ?? ''}-${i}`} zeile={z} mitKind={mehrereKinder} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </section>

      {!nichtInKraft && (
        <section aria-labelledby="rechnung-titel">
          <h3 id="rechnung-titel">
            {t.rechnung} <RegelId id={PRUEF_REGEL.formel} />
          </h3>
          {e.rechnungen.map((r) => (
            <div key={r.kind} className="karte rechnung">
              {mehrereKinder && <h4>{personName(r.kind, anfrage.namen)}</h4>}
              {rechnungZeilen(r).map((zeile, i) => (
                <p key={i} className="rechnung__zeile">
                  {zeile}
                </p>
              ))}
            </div>
          ))}
          <p className="hinweis">{t.formel.legende}</p>
        </section>
      )}

      <section aria-labelledby="anwendung-titel">
        <h3 id="anwendung-titel">{t.anwendung}</h3>
        <p className="hilfe">{t.anwendungHilfe}</p>
        {istPruefstatus(e.anwendung.status) && <StatusKarte status={e.anwendung.status} />}
        {mehrereKinder && (
          <ul className="fakten">
            {e.anwendung.kinder.map(
              (k) =>
                istPruefstatus(k.status) && (
                  <li key={k.id}>
                    {personName(k.id, anfrage.namen)}: <StatusMarke status={k.status} />
                  </li>
                ),
            )}
          </ul>
        )}
        {e.anwendung.flags.length === 0 ? (
          <p>{t.keineFlags}</p>
        ) : (
          <ul className="fakten">
            {e.anwendung.flags.map(({ flag, person }, i) => (
              <li key={i}>
                {person && mehrereKinder && <strong>{personName(person, anfrage.namen)}: </strong>}
                {texte.flags[flag]}{' '}
                {FLAGS[flag].regeln.map((id) => (
                  <RegelId key={id} id={id} />
                ))}{' '}
                <span className="wirkung">({t.wirkung[FLAGS[flag].wirkung]})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="technisch">
        <summary>{t.technisch}</summary>
        <pre tabIndex={0} aria-label={t.technisch}>
          {JSON.stringify(stand.roh, null, 2)}
        </pre>
      </details>

      <div className="navigation">{zurueck}</div>
    </div>
  )
}
