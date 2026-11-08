/** Ergebnis einer Gesuchseinheit: Satz, Status, Fakten, Beträge pro Kind, Was fehlt, Gemeindeentscheid. */
import type { Ergebnis as ErgebnisDaten } from '../../api/antwort'
import type { Client } from '../../api/client'
import { StatusKarte } from '../../komponenten/StatusKarte'
import { texte } from '../../texte/de'
import { alsProzent, aufzaehlen, chfRund, personName } from '../../texte/format'
import { F, FLAGS, Pruefstatus, type FlagName, type FlagWirkung } from '../../vertrag'
import { frageZuFlag } from '../fragen'
import { Betraege } from './Betraege'
import { Pruefung } from './Pruefung'
import { gemeindeVon, kindIndex, type Anfrage, type Namen } from './berechnung'

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

/** Ergebnis einer Gesuchseinheit. */
export function GesuchErgebnis({
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
        <button type="button" className="knopf knopf--sekundaer" onClick={onWarum}>
          {t.warum}
        </button>
      </div>
    </section>
  )
}
