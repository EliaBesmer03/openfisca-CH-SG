import type { KindErgebnis } from '../../api/antwort'
import { StatusMarke } from '../../komponenten/StatusKarte'
import { texte } from '../../texte/de'
import { chf, datum, personName } from '../../texte/format'
import { Pruefstatus } from '../../vertrag'
import type { Namen } from './berechnung'

/** Betrag in CHF; fehlt er in der Antwort, „nicht ermittelt“. */
export function Betrag({ n }: { n: number | null }) {
  return n === null ? <span className="nicht-ermittelt">{texte.ergebnis.nichtErmittelt}</span> : <>{chf(n)}</>
}

/** Beträge pro Monat für ein Kind. */
export function Betraege({ kind, gemeinde, mehrereKinder, namen }: { kind: KindErgebnis; gemeinde: string | null; mehrereKinder: boolean; namen: Namen }) {
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
            <td><Betrag n={kind.kostenMonat} /></td>
          </tr>
          <tr>
            <th scope="row">{t.mindestbeitrag}</th>
            <td><Betrag n={kind.beitragMindest} /></td>
          </tr>
          <tr className="unterzeile">
            <th scope="row">{t.davonKanton}</th>
            <td><Betrag n={kind.anteilKanton} /></td>
          </tr>
          <tr className="unterzeile">
            <th scope="row">{t.davonGemeinde}</th>
            <td><Betrag n={kind.anteilGemeinde} /></td>
          </tr>
          <tr>
            <th scope="row">{gemeinde ? t.zusatzbeitrag(gemeinde) : t.zusatzbeitragOhneGemeinde}</th>
            <td><Betrag n={kind.zusatzbeitrag} /></td>
          </tr>
          <tr className="summe">
            <th scope="row">{t.total}</th>
            <td><Betrag n={kind.beitragTotal} /></td>
          </tr>
          <tr>
            <th scope="row">{t.restkosten}</th>
            <td><Betrag n={kind.restkosten} /></td>
          </tr>
          <tr>
            <th scope="row">{t.beitraegeAb}</th>
            <td>{kind.beitragAb === null ? <Betrag n={null} /> : datum(kind.beitragAb)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
