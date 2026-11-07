/**
 * Ergebnis: pro Gesuchseinheit Satz, Statuskarte, Fakten, Beträge pro Kind, Was fehlt /
 * Entscheid-Simulation und Warum-Knopf; bei mehreren Gesuchen (Patchwork) die Summe.
 * Alle Werte kommen von der API; das Frontend addiert nur die Beträge der Gesuche.
 */
import { useEffect, useState } from 'react'
import type { Ergebnis as ErgebnisDaten, KindErgebnis } from '../api/antwort'
import type { Client } from '../api/client'
import { familienEingabe, mitEntscheid } from '../api/situation'
import { DatumFeld, WeissNichtFeld, ZahlFeld } from '../komponenten/Felder'
import { StatusKarte, StatusMarke } from '../komponenten/StatusKarte'
import { texte } from '../texte/de'
import { fehlerText } from '../texte/fehler'
import { alsProzent, aufzaehlen, chf, chfRund, datum, personName } from '../texte/format'
import {
  Ausnahmegrund,
  Entscheid,
  F,
  FLAGS,
  Pruefstatus,
  V,
  gemeindeName,
  istSonderwert,
  type FlagName,
  type FlagWirkung,
  type Situation,
} from '../vertrag'
import type { Formular } from '../zustand/formular'
import { frageZuFlag, kindName } from './fragen'

export type Anfrage = {
  situation: Situation
  periode: string
  /** Formular: „Zur Frage“-Links möglich; Demo: Situation stammt aus einem Fixture. */
  quelle: 'formular' | 'demo'
  /** Anzeigenamen der Kinder nach Personen-ID */
  namen?: Record<string, string>
}

type Namen = Readonly<Record<string, string>> | undefined
/** Position im Formular aus der Personen-ID `kind_3` → 2. */
const kindIndex = (id: string) => {
  const nr = /^kind_(\d+)$/.exec(id)
  return nr ? Number(nr[1]) - 1 : undefined
}

type Laden<T> = { zustand: 'laedt' } | { zustand: 'fehler'; text: string } | { zustand: 'ok'; daten: T }


/** Sendet die Anfrage; „lädt“, solange keine Antwort zu genau dieser Anfrage und diesem Versuch vorliegt. */
function useBerechnung(client: Client, anfrage: Anfrage | null, versuch = 0): Laden<ErgebnisDaten> | null {
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
function useBerechnungen(client: Client, anfragen: readonly Anfrage[], versuch: number): Laden<ErgebnisDaten>[] {
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

const wert = (n: number | null, format: (n: number) => string = chf) =>
  n === null ? <span className="nicht-ermittelt">{texte.ergebnis.nichtErmittelt}</span> : format(n)

const REIHENFOLGE: FlagWirkung[] = ['KEIN', 'FEHLT', 'PRUEFUNG', 'INFO']
/** Werden an eigener Stelle gezeigt (Banner, Zusatzbeitrag), nicht als Fakt. */
const NICHT_ALS_FAKT: FlagName[] = [F.flag_verordnung_entwurf, F.flag_zusatzbeitrag_platzhalter]

type FlagFund = { flag: FlagName; kindNummer?: number; kindName?: string }

function alleFlags(e: ErgebnisDaten, namen: Namen): FlagFund[] {
  const funde: FlagFund[] = e.familie.flags.map((flag) => ({ flag }))
  e.kinder.forEach((k) =>
    k.flags.forEach((flag) =>
      funde.push({ flag, kindNummer: kindIndex(k.id), kindName: e.kinder.length > 1 ? personName(k.id, namen) : undefined }),
    ),
  )
  return funde.sort((a, b) => REIHENFOLGE.indexOf(FLAGS[a.flag].wirkung) - REIHENFOLGE.indexOf(FLAGS[b.flag].wirkung))
}

function FlagZeile({ fund }: { fund: FlagFund }) {
  return (
    <>
      {fund.kindName && <strong>{fund.kindName}: </strong>}
      {texte.flags[fund.flag]}
    </>
  )
}

function Satz({ e, namen }: { e: ErgebnisDaten; namen: Namen }) {
  const s = texte.satz
  switch (e.status) {
    case Pruefstatus.ANSPRUCH: {
      const mitAnspruch = e.kinder.filter((k) => k.status === Pruefstatus.ANSPRUCH)
      const betrag = e.familie.beitragTotal ?? (mitAnspruch.length === 1 ? mitAnspruch[0].beitragTotal : null)
      if (betrag === null) return null
      const wer = aufzaehlen(mitAnspruch.map((k) => personName(k.id, namen)))
      // A7: ANSPRUCH auch mit Beitrag 0 (z. B. Einkommen über MaxmE) – dann nicht „Sie erhalten CHF 0“.
      if (Math.round(betrag) === 0) {
        const wegenEinkommen = e.familie.flags.includes(F.flag_me_ueber_maxme)
        return <p className="satz">{wegenEinkommen ? s.ANSPRUCH_NULL_EINKOMMEN(wer) : s.ANSPRUCH_NULL(wer)}</p>
      }
      return <p className="satz">{s.ANSPRUCH(chfRund(betrag), wer)}</p>
    }
    case Pruefstatus.PRUEFUNG_DURCH_GEMEINDE: {
      const mitSchaetzung = e.kinder.filter((k) => k.schaetzungFallsBewilligt !== null && k.schaetzungFallsBewilligt > 0)
      const teile = mitSchaetzung.map((k) =>
        mitSchaetzung.length === 1 ? chfRund(k.schaetzungFallsBewilligt!) : texte.ergebnis.pruefung.betragFuer(chfRund(k.schaetzungFallsBewilligt!), personName(k.id, namen)),
      )
      return <p className="satz">{s.PRUEFUNG_DURCH_GEMEINDE(aufzaehlen(teile))}</p>
    }
    default:
      return <p className="satz">{s[e.status]()}</p>
  }
}

function Fakten({ e, namen }: { e: ErgebnisDaten; namen: Namen }) {
  const t = texte.ergebnis
  const zeilen = alleFlags(e, namen)
    .filter((f) => !NICHT_ALS_FAKT.includes(f.flag))
    .slice(0, 3)
    .map((f) => <FlagZeile key={`${f.flag}-${f.kindNummer ?? ''}`} fund={f} />)
  if (zeilen.length < 3 && e.familie.meMassgebend !== null) {
    zeilen.push(
      <>{t.faktMe(chfRund(e.familie.meMassgebend))}</>,
    )
  }
  if (zeilen.length < 3 && e.familie.einkommensfaktor !== null) {
    zeilen.push(
      <>{t.faktFaktor(alsProzent(e.familie.einkommensfaktor))}</>,
    )
  }
  if (zeilen.length === 0) return null
  return (
    <section>
      <h3>{t.fakten}</h3>
      <ul className="fakten">
        {zeilen.map((z, i) => (
          <li key={i}>{z}</li>
        ))}
      </ul>
    </section>
  )
}

function Betraege({ kind, gemeinde, mehrereKinder, namen }: { kind: KindErgebnis; gemeinde: string | null; mehrereKinder: boolean; namen: Namen }) {
  const t = texte.ergebnis
  const name = personName(kind.id, namen)
  return (
    <div className="betraege">
      <table>
        <caption>
          {mehrereKinder ? `${t.betraege}: ${name}` : t.betraege} {kind.status !== Pruefstatus.ANSPRUCH && <StatusMarke status={kind.status} />}
        </caption>
        <tbody>
          <tr>
            <th scope="row">{t.kosten}</th>
            <td>{wert(kind.kostenMonat)}</td>
          </tr>
          <tr>
            <th scope="row">{t.mindestbeitrag}</th>
            <td>{wert(kind.beitragMindest)}</td>
          </tr>
          <tr className="unterzeile">
            <th scope="row">{t.davonKanton}</th>
            <td>{wert(kind.anteilKanton)}</td>
          </tr>
          <tr className="unterzeile">
            <th scope="row">{t.davonGemeinde}</th>
            <td>{wert(kind.anteilGemeinde)}</td>
          </tr>
          <tr>
            <th scope="row">{gemeinde ? t.zusatzbeitrag(gemeinde) : t.zusatzbeitragOhneGemeinde}</th>
            <td>{wert(kind.zusatzbeitrag)}</td>
          </tr>
          <tr className="summe">
            <th scope="row">{t.total}</th>
            <td>{wert(kind.beitragTotal)}</td>
          </tr>
          <tr>
            <th scope="row">{t.restkosten}</th>
            <td>{wert(kind.restkosten)}</td>
          </tr>
          <tr>
            <th scope="row">{t.beitraegeAb}</th>
            <td>{kind.beitragAb === null ? wert(null) : datum(kind.beitragAb)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function WasFehlt({ e, namen, onZurFrage }: { e: ErgebnisDaten; namen: Namen; onZurFrage?: (schluessel: string) => void }) {
  const fehlend = alleFlags(e, namen).filter((f) => FLAGS[f.flag].wirkung === 'FEHLT')
  if (fehlend.length === 0) return null
  return (
    <section>
      <h3>{texte.ergebnis.wasFehlt}</h3>
      <ul className="fakten">
        {fehlend.map((f, i) => {
          const frage = onZurFrage ? frageZuFlag(f.flag, f.kindNummer) : null
          return (
            <li key={i}>
              <FlagZeile fund={f} />{' '}
              {frage && (
                <button type="button" className="link" onClick={() => onZurFrage!(frage)}>
                  {texte.ergebnis.zurFrage}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

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
                {personName(k.id, namen)}: {wert(k.beitragTotal)}
              </li>
            ))}
          </ul>
        </StatusKarte>
      )}
    </div>
  )
}

function Pruefung({ e, anfrage, client }: { e: ErgebnisDaten; anfrage: Anfrage; client: Client }) {
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

/** Ergebnis einer Gesuchseinheit. */
function GesuchErgebnis({
  e,
  anfrage,
  client,
  mehrere,
  onWarum,
  onZurFrage,
}: {
  e: ErgebnisDaten
  anfrage: Anfrage
  client: Client
  mehrere: boolean
  onWarum: () => void
  onZurFrage?: (schluessel: string) => void
}) {
  const t = texte.ergebnis
  const namen = anfrage.namen
  const gemeinde = gemeindeVon(e, anfrage)
  const pruefung = e.status === Pruefstatus.PRUEFUNG_DURCH_GEMEINDE || e.ausnahmeOffen
  return (
    <section className={mehrere ? 'gesuch' : undefined}>
      {mehrere && <h3>{t.gesuchFuer(aufzaehlen(e.kinder.map((k) => personName(k.id, namen))))}</h3>}
      <Satz e={e} namen={namen} />
      <StatusKarte status={e.status} />
      <Fakten e={e} namen={namen} />
      {e.kinder.map((k) => (
        <Betraege key={k.id} kind={k} gemeinde={gemeinde} mehrereKinder={e.kinder.length > 1} namen={namen} />
      ))}
      {e.status === Pruefstatus.ANGABEN_FEHLEN && <WasFehlt e={e} namen={namen} onZurFrage={onZurFrage} />}
      {pruefung && <Pruefung e={e} anfrage={anfrage} client={client} />}
      <div className="navigation">
        <button type="button" className="knopf" onClick={onWarum}>
          {t.warum}
        </button>
      </div>
    </section>
  )
}

function gemeindeVon(e: ErgebnisDaten, anfrage: Anfrage): string | null {
  const schluessel = e.familie.wohngemeinde ?? familienEingabe(anfrage.situation, V.wohngemeinde, anfrage.periode)
  return typeof schluessel === 'string' && !istSonderwert(schluessel) ? gemeindeName(schluessel) : null
}

/** Seltene Angaben nach dem Ergebnis: Betreuungsbeginn, Gesuchsdatum, Einkommensrückgang, Zusatzbeitrag. */
function GenauerRechnen({ formular, onAnwenden }: { formular: Formular; onAnwenden: (f: Formular) => void }) {
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

  if (staende.some((s) => s.zustand === 'laedt')) return <p aria-live="polite">{t.laedt}</p>
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
