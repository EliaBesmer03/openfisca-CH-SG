import { describe, expect, it } from 'vitest'
import f01Request from '../../../contract/fixtures/F01_standardfamilie.request.json'
import { Ausnahmegrund, Entscheid, F, HaushaltForm, Partnerschaft, ROLLE, V, flagNamen } from '../vertrag'
import { leeresKind } from '../zustand/formular'
import { ALLE_AUSGABEN, baueGesuche, jahreSeit, periodeFuer } from './situation'
import { formularF1 } from './testdaten'

const P = '2028-08'

describe('baueGesuche', () => {
  it('Paar mit gemeinsamem Kind: ein Gesuch, beide als Erziehungsberechtigte, gemeinsamer Haushalt', () => {
    const [g, ...rest] = baueGesuche(formularF1())
    expect(rest).toHaveLength(0)
    expect(g.typ).toBe('gemeinsam')
    expect(g.periode).toBe(P)
    expect(g.namen).toEqual({ kind_1: 'Lina' })
    const fam = g.situation.familien.familie
    expect(fam[ROLLE.erziehungsberechtigte]).toEqual(['eb_1', 'eb_2'])
    expect(fam[ROLLE.partnerinnen]).toBeUndefined()
    expect(fam[V.haushalt_form]).toEqual({ [P]: HaushaltForm.GEMEINSAMER_HAUSHALT })
    expect(g.situation.persons.eb_2).toEqual({ [V.erwerbspensum]: { [P]: 60 }, [V.me_veranlagung]: { [P]: 37000 } })
    const lina = g.situation.persons.kind_1
    expect(lina[V.geburtsdatum]).toEqual({ [P]: '2026-06-15' })
    expect(lina[V.alter_monate]).toBeUndefined() // rechnet das Modell aus dem Geburtsdatum
    expect(lina[V.betreuungsbeginn]).toEqual({ [P]: '2028-08-15' })
  })

  it('fragt standardmässig alle Ausgaben inkl. aller Flags an', () => {
    const s = baueGesuche(formularF1())[0].situation
    const kind = s.persons.kind_1
    const familie = s.familien.familie
    for (const flag of flagNamen) {
      const ziel = flag in kind ? kind : familie
      expect(ziel[flag]).toEqual({ [P]: null })
    }
    expect(ALLE_AUSGABEN.kind).not.toContain(V.partner_gefestigt)
  })

  it('ohne Partner: nur Sie, getrennter Haushalt', () => {
    const f = formularF1()
    f.partnerVorhanden = false
    const g = baueGesuche(f)[0]
    expect(g.typ).toBe('allein')
    expect(g.situation.familien.familie[ROLLE.erziehungsberechtigte]).toEqual(['eb_1'])
    expect(g.situation.familien.familie[V.haushalt_form]).toEqual({ [P]: HaushaltForm.GETRENNTER_HAUSHALT })
    expect(g.situation.persons.eb_2).toBeUndefined()
  })

  it('Partner/in nicht Elternteil: unter partnerinnen, Konkubinat mit Jahren seit dem Zusammenzug', () => {
    const f = formularF1()
    f.kinder[0].partnerIstElternteil = false
    f.verheiratet = false
    f.zusammenSeit = '2027-08'
    const g = baueGesuche(f)[0]
    expect(g.typ).toBe('partner')
    const fam = g.situation.familien.familie
    expect(fam[ROLLE.erziehungsberechtigte]).toEqual(['eb_1'])
    expect(fam[ROLLE.partnerinnen]).toEqual(['partner_1'])
    expect(fam[V.haushalt_form]).toEqual({ [P]: HaushaltForm.GETRENNTER_HAUSHALT })
    expect(g.situation.persons.partner_1).toEqual({
      [V.erwerbspensum]: { [P]: 60 },
      [V.me_veranlagung]: { [P]: 37000 },
      [V.partnerschaft]: { [P]: Partnerschaft.KONKUBINAT },
      [V.konkubinat_jahre]: { [P]: 1 },
      [V.partner_gefestigt]: { [P]: null },
    })
  })

  it('verheiratet: Ehe statt Konkubinat', () => {
    const f = formularF1()
    f.kinder[0].partnerIstElternteil = false
    f.verheiratet = true
    const p = baueGesuche(f)[0].situation.persons.partner_1
    expect(p[V.partnerschaft]).toEqual({ [P]: Partnerschaft.EHE_ODER_EINGETRAGENE_PARTNERSCHAFT })
    expect(p[V.konkubinat_jahre]).toBeUndefined()
  })

  it('Patchwork: Kind aus früherer Beziehung und gemeinsames Kind ergeben zwei Gesuche', () => {
    const f = formularF1()
    f.kinder[0].partnerIstElternteil = false
    f.verheiratet = false
    f.zusammenSeit = '2027-08'
    f.kinder.push({ ...f.kinder[0], name: 'Mia', partnerIstElternteil: true })
    const gesuche = baueGesuche(f)
    expect(gesuche.map((g) => [g.typ, g.kindIndizes])).toEqual([
      ['partner', [0]],
      ['gemeinsam', [1]],
    ])
    expect(gesuche[0].situation.familien.familie[ROLLE.kinder]).toEqual(['kind_1'])
    expect(gesuche[1].situation.familien.familie[ROLLE.kinder]).toEqual(['kind_2'])
    expect(gesuche[1].namen).toEqual({ kind_2: 'Mia' })
  })

  it('gemeinsame Veranlagung: ganzer Betrag bei Ihnen, 0 bei der Partnerin', () => {
    const f = formularF1()
    f.gemeinsamVeranlagt = true
    f.sie.meVeranlagung = 97000
    const s = baueGesuche(f)[0].situation
    expect(s.persons.eb_1[V.me_veranlagung]).toEqual({ [P]: 97000 })
    expect(s.persons.eb_2[V.me_veranlagung]).toEqual({ [P]: 0 })
  })

  it('„Weiss ich nicht“ beim Einkommen setzt me_bekannt = false und lässt den Wert weg', () => {
    const f = formularF1()
    f.partner.meBekannt = false
    const eb2 = baueGesuche(f)[0].situation.persons.eb_2
    expect(eb2[V.me_bekannt]).toEqual({ [P]: false })
    expect(eb2[V.me_veranlagung]).toBeUndefined()
  })

  it('unbeantwortete Angaben werden weggelassen, Betreuungsbeginn ohne Angabe = Gesuchsdatum', () => {
    const f = formularF1()
    f.kinder[0] = leeresKind()
    const s = baueGesuche(f)[0].situation
    const kind = s.persons.kind_1
    expect(kind[V.geburtsdatum]).toBeUndefined()
    expect(kind[V.angebot_typ]).toBeUndefined()
    expect(kind[V.betreuungstage_pro_woche]).toBeUndefined()
    expect(kind[V.betreuungsbeginn]).toEqual({ [P]: '2028-08-30' })
  })

  it('Ausnahme, Entscheid, Einkommensrückgang und Zusatzbeitrag werden gesendet, wenn gesetzt', () => {
    const f = formularF1()
    f.ausnahmegrund = Ausnahmegrund.FAMILIAERE_BELASTUNG
    f.ausnahmeEntscheid = Entscheid.BEWILLIGT
    f.einkommenGesunken = true
    f.meAktuell = 60000
    f.zusatzbeitragZ1 = 1
    const fam = baueGesuche(f)[0].situation.familien.familie
    expect(fam[V.ausnahmegrund]).toEqual({ [P]: Ausnahmegrund.FAMILIAERE_BELASTUNG })
    expect(fam[V.ausnahme_entscheid]).toEqual({ [P]: Entscheid.BEWILLIGT })
    expect(fam[V.antrag_aktuelle_gegebenheiten]).toEqual({ [P]: true })
    expect(fam[V.me_aktuell]).toEqual({ [P]: 60000 })
    expect(fam[V.zusatzbeitrag_z1_pro_stunde]).toEqual({ [P]: 1 })
    expect(fam[V.zusatzbeitrag_z2_pro_stunde]).toEqual({ [P]: null })
  })

  it('Standardwerte werden nicht gesendet', () => {
    const fam = baueGesuche(formularF1())[0].situation.familien.familie
    expect(fam[V.ausnahmegrund]).toBeUndefined()
    expect(fam[V.ausnahme_entscheid]).toBeUndefined()
    expect(fam[V.antrag_aktuelle_gegebenheiten]).toBeUndefined()
  })
})

describe('Hilfsfunktionen', () => {
  it('periodeFuer: Monat des Gesuchs, frühestens August 2028', () => {
    expect(periodeFuer('2026-11-07')).toBe('2028-08')
    expect(periodeFuer('2028-10-02')).toBe('2028-10')
    expect(periodeFuer('')).toBe('2028-08')
  })

  it('jahreSeit: auf Monate genau', () => {
    expect(jahreSeit('2026-08', '2028-08')).toBe(2)
    expect(jahreSeit('2027-02', '2028-08')).toBe(1.5)
    expect(jahreSeit('', '2028-08')).toBeNull()
  })
})

describe('mitAllenAusgaben', () => {
  it('ergänzt Demo-Situation F01 um alle Ausgaben, ohne Eingaben zu ändern', async () => {
    const { mitAllenAusgaben } = await import('./situation')
    const { findeFixture } = await import('./fixtures')
    const voll = mitAllenAusgaben(f01Request, '2028-09')
    expect(voll.persons.lina[F.flag_uebergangsregel]).toEqual({ '2028-09': null })
    expect(voll.familien.familie[F.flag_verordnung_entwurf]).toEqual({ '2028-09': null })
    expect(voll.persons.lina[V.alter_monate]).toEqual({ '2028-09': 26 })
    expect(voll.persons.lina[V.jahr_schulpflicht]).toEqual({ '2028-09': null })
    // Offline-Modus findet weiterhin F01
    expect(findeFixture(voll)?.fixture.id).toBe('F01_standardfamilie')
  })
})
