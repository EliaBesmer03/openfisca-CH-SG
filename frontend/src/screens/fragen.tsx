/**
 * Fragenkatalog nach docs/fragebogen_entwurf.md.
 *
 * Reihenfolge: Gemeinde → erstes Kind → Haushalt → Ergebnis; jedes weitere Kind hängt seine
 * Fragen hinten an, dazu nur die Haushaltsangaben, die mit ihm neu nötig werden.
 * Welche Fragen erscheinen, ist UX-Logik. Was rechtlich zählt (Abbruch, Mindestpensum,
 * gefestigte Partnerschaft), kommt aus der Zwischenprüfung beim Modell (Zwischenstand).
 */
import type { ReactNode } from 'react'
import { AuswahlFeld, DatumFeld, JaNeinFeld, MonatJahrFeld, TextFeld, WeissNichtFeld, ZahlFeld, type Option } from '../komponenten/Felder'
import { GemeindeAuswahl } from '../komponenten/GemeindeAuswahl'
import { gesuchsTyp, periodeFuer } from '../api/situation'
import type { Zwischenstand } from '../api/zwischenstand'
import { texte } from '../texte/de'
import { AngebotTyp, Ausnahmegrund, F, JaNeinUnbekannt, Schulstufe, type FlagName } from '../vertrag'
import type { Formular, FormularKind, FormularPerson } from '../zustand/formular'

export type Aendere = (aenderung: (entwurf: Formular) => void) => void

export type FrageDef = {
  schluessel: string
  titel: string
  hilfe?: string
  vollstaendig: (f: Formular) => boolean
  inhalt: (f: Formular, aendere: Aendere) => ReactNode
  /** Nach dem Beantworten die Zwischenprüfung beim Modell auslösen. */
  pruefen?: boolean
  /** Flags, die nach dieser Frage den Fragebogen beenden (pro Kind oder für die Familie). */
  abbruch?: { flags: readonly FlagName[]; kind?: number }
}

const t = texte.fragen
const MAX_PENSUM = 100

const zahl = (w: number, min = 0, max = Number.POSITIVE_INFINITY) => Number.isFinite(w) && w >= min && w <= max
const datumGueltig = (w: string) => /^\d{4}-\d{2}-\d{2}$/.test(w) && !Number.isNaN(Date.parse(w))
const monatGueltig = (w: string) => /^\d{4}-\d{2}$/.test(w)

const optionenAus = <T extends string>(werte: readonly T[], labels: Record<T, string>): Option<T>[] =>
  werte.map((wert) => ({ wert, label: labels[wert] }))

/** Name für Fragetexte: eingegebener Name, bei mehreren Kindern „Kind 2“, sonst null („Ihr Kind“). */
export function kindName(f: Formular, i: number): string | null {
  const name = f.kinder[i]?.name.trim()
  if (name) return name
  return f.kinder.length > 1 ? texte.personen.kind(i + 1) : null
}

/** Alter in vollendeten Jahren am Ersten des Rechenmonats (nur für die Anzeige von Frage 3). */
export function alterJahre(geburtsdatum: string, periode: string): number | null {
  const g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(geburtsdatum)
  const p = /^(\d{4})-(\d{2})$/.exec(periode)
  if (!g || !p) return null
  const [gj, gm, gt] = g.slice(1).map(Number)
  const [pj, pm] = p.slice(1).map(Number)
  return pj - gj - (pm < gm || (pm === gm && gt > 1) ? 1 : 0)
}

/** UX: Frage 3 erst ab 4 Jahren; jünger heisst sicher noch nicht im Kindergarten. */
const fragtSchule = (f: Formular, k: FormularKind) => (alterJahre(k.geburtsdatum, periodeFuer(f.gesuchsdatum)) ?? 0) >= 4
const eingeschult = (k: FormularKind) => k.schulstufe !== null && k.schulstufe !== Schulstufe.VORSCHULALTER

/** Hort und Sonderschule erst ab Kindergarten (sonst kein Höchstbeitrag, A-11). */
function angebotOptionen(k: FormularKind): Option<AngebotTyp>[] {
  const nurSchule: AngebotTyp[] = [AngebotTyp.SCHULERGAENZEND, AngebotTyp.SONDERSCHULE_SCHULERGAENZEND]
  const werte = AngebotTyp.werte.filter((w) => eingeschult(k) || !nurSchule.includes(w))
  return optionenAus(werte, texte.optionen.angebotTyp)
}

// ---------- Bedingungen über eine Teilmenge der Kinder ----------

const partner = (f: Formular) => f.partnerVorhanden === true

function braucheVerheiratet(f: Formular, kinder: readonly number[]) {
  return partner(f) && kinder.some((i) => f.kinder[i].partnerIstElternteil === false)
}

/** Pensum und Einkommen der Partnerin / des Partners zählen: Elternteil, oder gefestigt laut Modell. */
export function partnerZaehlt(f: Formular, kinder: readonly number[], stand: Zwischenstand) {
  if (!partner(f)) return false
  if (kinder.some((i) => f.kinder[i].partnerIstElternteil === true)) return true
  return braucheVerheiratet(f, kinder) && stand.partnerGefestigt !== false
}

function braucheAusnahme(f: Formular, kinder: readonly number[], stand: Zwischenstand) {
  if (!Number.isFinite(f.sie.erwerbspensum)) return false
  const typen = new Set(kinder.map((i) => gesuchsTyp(f, f.kinder[i])))
  return [...typen].some((typ) => stand.familienFlags[typ]?.includes(F.flag_pensum_unter_minimum))
}

const bis = (i: number) => Array.from({ length: i + 1 }, (_, n) => n)

// ---------- Fragen ----------

function kindFragen(f: Formular, i: number): FrageDef[] {
  const kind = f.kinder[i]
  const name = kindName(f, i)
  const s = `k${i}_`
  const setze = (a: Aendere, teil: Partial<FormularKind>) => a((e) => void Object.assign(e.kinder[i], teil))
  const fragen: FrageDef[] = [
    {
      schluessel: `${s}geburt`,
      titel: i === 0 ? t.kind.titel : t.kind.titelWeiteres,
      hilfe: t.kind.hilfe,
      vollstaendig: () => datumGueltig(kind.geburtsdatum),
      pruefen: true,
      abbruch: { flags: [F.flag_kind_zu_jung], kind: i },
      inhalt: (_, a) => (
        <>
          <TextFeld label={t.kind.name} wert={kind.name} onChange={(w) => setze(a, { name: w })} autocomplete="given-name" />
          <DatumFeld label={t.kind.geburtsdatum} wert={kind.geburtsdatum} onChange={(w) => setze(a, { geburtsdatum: w })} />
        </>
      ),
    },
  ]
  if (fragtSchule(f, kind)) {
    fragen.push({
      schluessel: `${s}schule`,
      titel: t.schule.titel(name),
      vollstaendig: () => kind.schulstufe !== null,
      pruefen: true,
      abbruch: { flags: [F.flag_kind_zu_alt], kind: i },
      inhalt: (_, a) => (
        <AuswahlFeld
          legende={t.schule.titel(name)}
          verborgeneLegende
          optionen={optionenAus(Schulstufe.werte, texte.optionen.schulstufe)}
          wert={kind.schulstufe}
          onChange={(w) =>
            a((e) => {
              const k = e.kinder[i]
              k.schulstufe = w
              // Angebot passt evtl. nicht mehr zur Schulstufe
              if (k.angebotTyp && !angebotOptionen(k).some((o) => o.wert === k.angebotTyp)) k.angebotTyp = null
            })
          }
        />
      ),
    })
  }
  fragen.push(
    {
      schluessel: `${s}angebot`,
      titel: t.angebot.titel(name),
      vollstaendig: () =>
        kind.angebotTyp !== null && (kind.angebotTyp === AngebotTyp.ANDERES || kind.angebotAngemeldet !== null),
      pruefen: true,
      abbruch: {
        flags: [F.flag_angebot_nicht_anerkannt, F.flag_angebot_nicht_angemeldet, F.flag_kein_hoechstbeitrag],
        kind: i,
      },
      inhalt: (_, a) => (
        <>
          <AuswahlFeld
            legende={t.angebot.titel(name)}
            verborgeneLegende
            optionen={angebotOptionen(kind)}
            wert={kind.angebotTyp}
            onChange={(w) => setze(a, { angebotTyp: w })}
          />
          {kind.angebotTyp !== null && kind.angebotTyp !== AngebotTyp.ANDERES && (
            <>
              <AuswahlFeld
                legende={t.angebot.angemeldet}
                optionen={[
                  { wert: JaNeinUnbekannt.JA, label: texte.frage.ja },
                  { wert: JaNeinUnbekannt.NEIN, label: texte.frage.nein },
                  { wert: JaNeinUnbekannt.UNBEKANNT, label: texte.frage.weissNicht },
                ]}
                wert={kind.angebotAngemeldet}
                onChange={(w) => setze(a, { angebotAngemeldet: w })}
              />
              <p className="hilfe">{t.angebot.angemeldetHilfe}</p>
            </>
          )}
        </>
      ),
    },
    {
      schluessel: `${s}umfang`,
      titel: t.umfang.titel(name),
      hilfe: t.umfang.hilfe,
      vollstaendig: () =>
        zahl(kind.betreuungstageProWoche, 0, 7) && zahl(kind.betreuungsstundenProTag, 0, 24) && zahl(kind.kostenProStunde),
      inhalt: (_, a) => (
        <>
          <ZahlFeld label={t.umfang.tage} min={0} max={7} schritt={0.5} wert={kind.betreuungstageProWoche} onChange={(w) => setze(a, { betreuungstageProWoche: w })} />
          <ZahlFeld label={t.umfang.stunden} min={0} max={24} schritt={0.5} wert={kind.betreuungsstundenProTag} onChange={(w) => setze(a, { betreuungsstundenProTag: w })} />
          <ZahlFeld label={t.umfang.kosten} einheit={texte.einheiten.chf} min={0} schritt={0.05} wert={kind.kostenProStunde} onChange={(w) => setze(a, { kostenProStunde: w })} />
          <p className="hilfe">{t.umfang.hilfeGetrennt}</p>
        </>
      ),
    },
  )
  return fragen
}

function elternteilFrage(f: Formular, i: number): FrageDef {
  const name = kindName(f, i)
  return {
    schluessel: `k${i}_elternteil`,
    titel: t.elternteil.titel(name),
    vollstaendig: (x) => x.kinder[i].partnerIstElternteil !== null,
    pruefen: true,
    inhalt: (x, a) => (
      <JaNeinFeld
        legende={t.elternteil.titel(name)}
        wert={x.kinder[i].partnerIstElternteil}
        onChange={(ja) => a((e) => void (e.kinder[i].partnerIstElternteil = ja))}
      />
    ),
  }
}

function verheiratetFrage(suffix: string): FrageDef {
  return {
    schluessel: `verheiratet${suffix}`,
    titel: t.verheiratet.titel,
    hilfe: t.verheiratet.hilfe,
    vollstaendig: (x) => x.verheiratet === true || (x.verheiratet === false && monatGueltig(x.zusammenSeit)),
    pruefen: true,
    inhalt: (x, a) => (
      <>
        <AuswahlFeld
          legende={t.verheiratet.titel}
          verborgeneLegende
          optionen={[
            { wert: 'ja', label: t.verheiratet.ja },
            { wert: 'nein', label: t.verheiratet.nein },
          ]}
          wert={x.verheiratet === null ? null : x.verheiratet ? 'ja' : 'nein'}
          onChange={(w) => a((e) => void (e.verheiratet = w === 'ja'))}
        />
        {x.verheiratet === false && (
          <MonatJahrFeld
            label={t.verheiratet.seit}
            hinweis={t.verheiratet.seitHinweis}
            wert={x.zusammenSeit}
            onChange={(w) => a((e) => void (e.zusammenSeit = w))}
          />
        )}
      </>
    ),
  }
}

function pensumFrage(suffix: string, mitSie: boolean, mitPartner: boolean): FrageDef {
  const setze = (a: Aendere, wer: 'sie' | 'partner', w: number) => a((e) => void (e[wer].erwerbspensum = w))
  return {
    schluessel: `pensum${suffix}`,
    titel: mitSie ? t.pensum.titel : t.pensum.titelPartner,
    hilfe: t.pensum.hilfe,
    vollstaendig: (x) => (!mitSie || zahl(x.sie.erwerbspensum, 0, MAX_PENSUM)) && (!mitPartner || zahl(x.partner.erwerbspensum, 0, MAX_PENSUM)),
    pruefen: true,
    inhalt: (x, a) => (
      <>
        {mitSie && (
          <ZahlFeld label={t.pensum.sie} einheit={texte.einheiten.prozent} min={0} max={MAX_PENSUM} schritt={5} wert={x.sie.erwerbspensum} onChange={(w) => setze(a, 'sie', w)} />
        )}
        {mitPartner && (
          <ZahlFeld label={t.pensum.partner} einheit={texte.einheiten.prozent} min={0} max={MAX_PENSUM} schritt={5} wert={x.partner.erwerbspensum} onChange={(w) => setze(a, 'partner', w)} />
        )}
      </>
    ),
  }
}

function ausnahmeFrage(suffix: string): FrageDef {
  return {
    schluessel: `ausnahme${suffix}`,
    titel: t.ausnahme.titel,
    hilfe: t.ausnahme.hilfe,
    vollstaendig: (x) => x.ausnahmegrund !== null,
    pruefen: true,
    abbruch: { flags: [F.flag_ausnahme_kein_grund] },
    inhalt: (x, a) => (
      <AuswahlFeld
        legende={t.ausnahme.titel}
        verborgeneLegende
        optionen={optionenAus(
          [...Ausnahmegrund.werte.filter((w) => w !== Ausnahmegrund.KEINER), Ausnahmegrund.KEINER],
          texte.optionen.ausnahmegrund,
        )}
        wert={x.ausnahmegrund}
        onChange={(w) => a((e) => void (e.ausnahmegrund = w))}
      />
    ),
  }
}

const einkommenOk = (p: FormularPerson) => !p.meBekannt || zahl(p.meVeranlagung)

function einkommenFeld(label: string, p: FormularPerson, setze: (teil: Partial<FormularPerson>) => void) {
  return (
    <div className="personengruppe" key={label}>
      <ZahlFeld label={label} einheit={t.einkommen.proJahr} min={0} schritt={100} wert={p.meVeranlagung} deaktiviert={!p.meBekannt} onChange={(w) => setze({ meVeranlagung: w })} />
      <WeissNichtFeld wert={!p.meBekannt} onChange={(w) => setze({ meBekannt: !w })} />
    </div>
  )
}

function einkommenFrage(suffix: string, mitSie: boolean, mitPartner: boolean): FrageDef {
  const setze = (a: Aendere, wer: 'sie' | 'partner') => (teil: Partial<FormularPerson>) => a((e) => void Object.assign(e[wer], teil))
  const partnerFeld = (x: Formular) => mitPartner && !x.gemeinsamVeranlagt
  return {
    schluessel: `einkommen${suffix}`,
    titel: mitSie ? t.einkommen.titel : t.einkommen.titelPartner,
    hilfe: t.einkommen.hilfe,
    vollstaendig: (x) => (!mitSie || einkommenOk(x.sie)) && (!partnerFeld(x) || einkommenOk(x.partner)),
    inhalt: (x, a) => (
      <>
        {mitSie && einkommenFeld(mitPartner && x.gemeinsamVeranlagt ? t.einkommen.beide : t.einkommen.sie, x.sie, setze(a, 'sie'))}
        {mitSie && mitPartner && (
          <WeissNichtFeld label={t.einkommen.gemeinsam} wert={x.gemeinsamVeranlagt} onChange={(w) => a((e) => void (e.gemeinsamVeranlagt = w))} />
        )}
        {partnerFeld(x) && einkommenFeld(t.einkommen.partner, x.partner, setze(a, 'partner'))}
      </>
    ),
  }
}

export function fragenFuer(f: Formular, stand: Zwischenstand): FrageDef[] {
  const fragen: FrageDef[] = [
    {
      schluessel: 'wohngemeinde',
      titel: t.wohngemeinde.titel,
      hilfe: t.wohngemeinde.hilfe,
      vollstaendig: (x) => x.wohngemeinde !== '',
      pruefen: true,
      abbruch: { flags: [F.flag_wohnsitz_nicht_sg] },
      inhalt: (x, a) => <GemeindeAuswahl wert={x.wohngemeinde} onChange={(w) => a((e) => void (e.wohngemeinde = w))} />,
    },
    ...kindFragen(f, 0),
    {
      schluessel: 'partner',
      titel: t.partner.titel,
      vollstaendig: (x) => x.partnerVorhanden !== null,
      inhalt: (x, a) => (
        <JaNeinFeld legende={t.partner.titel} wert={x.partnerVorhanden} onChange={(ja) => a((e) => void (e.partnerVorhanden = ja))} />
      ),
    },
  ]
  if (partner(f)) fragen.push(elternteilFrage(f, 0))
  if (braucheVerheiratet(f, [0])) fragen.push(verheiratetFrage(''))
  fragen.push(pensumFrage('', true, partnerZaehlt(f, [0], stand)))
  if (braucheAusnahme(f, [0], stand)) fragen.push(ausnahmeFrage(''))
  fragen.push(einkommenFrage('', true, partnerZaehlt(f, [0], stand)))

  // Weitere Kinder: eigene Fragen, dann nur die Haushaltsangaben, die mit diesem Kind neu nötig werden.
  for (let i = 1; i < f.kinder.length; i++) {
    fragen.push(...kindFragen(f, i))
    if (partner(f)) fragen.push(elternteilFrage(f, i))
    const vorher = bis(i - 1)
    const jetzt = bis(i)
    if (braucheVerheiratet(f, jetzt) && !braucheVerheiratet(f, vorher)) fragen.push(verheiratetFrage(`@${i}`))
    const partnerNeu = partnerZaehlt(f, jetzt, stand) && !partnerZaehlt(f, vorher, stand)
    if (partnerNeu) fragen.push(pensumFrage(`@${i}`, false, true))
    if (braucheAusnahme(f, jetzt, stand) && !braucheAusnahme(f, vorher, stand)) fragen.push(ausnahmeFrage(`@${i}`))
    if (partnerNeu) fragen.push(einkommenFrage(`@${i}`, false, true))
  }
  return fragen
}

/** Antworten auf nicht (mehr) gestellte Fragen zurücksetzen, bevor gesendet wird. */
export function bereinige(f: Formular, stand: Zwischenstand): Formular {
  const schluessel = new Set(fragenFuer(f, stand).map((q) => q.schluessel.split('@')[0]))
  return {
    ...f,
    ausnahmegrund: schluessel.has('ausnahme') ? f.ausnahmegrund : null,
    kinder: f.kinder.map((k) => ({ ...k, partnerIstElternteil: partner(f) ? k.partnerIstElternteil : null })),
  }
}

/** Zu welcher Frage führt „Was noch fehlt“ bei einem Flag (nur Flags mit Wirkung FEHLT). */
export function frageZuFlag(flag: FlagName, kindIndex?: number): string | null {
  switch (flag) {
    case F.flag_wohnsitz_unbekannt:
      return 'wohngemeinde'
    case F.flag_pensum_unbekannt:
      return 'pensum'
    case F.flag_haushalt_inkonsistent:
      return 'partner'
    case F.flag_me_unbekannt:
      return 'einkommen'
    case F.flag_angebot_anmeldung_unbekannt:
      return kindIndex === undefined ? null : `k${kindIndex}_angebot`
    default:
      return null
  }
}
