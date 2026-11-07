"""Rechtsschicht: Berechnung der Beiträge (KiBG-6, 18, 20; KiBV-13 bis 15, 24, Anhang)."""

import numpy as np
from numpy import select
from openfisca_core.indexed_enums import Enum
from openfisca_core.model_api import max_, min_
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import KEIN_DATUM, anteil_monat_ab, datum_plus_monate
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL
from openfisca_ch_sg.variables.kibg.enums import Altersstufe, AngebotTyp, Schulstufe


class einkommensfaktor(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    label = "Einkommensfaktor des linearen Modells (1 − (ME − MinmE) / (MaxmE − MinmE)), begrenzt auf 0 bis 1"
    reference = KIBV_URL
    documentation = (
        "KiBV-Anh | Anhang, Art. 15 Abs. 1 und 2 KiBV | "
        "B = (MaxV + Z1) × (1 − (ME − MinmE)/(MaxmE − MinmE)) + Z2; bis MinmE maximaler, über MaxmE kein Beitrag | "
        "Quellentyp: VERORDNUNG_ENTWURF"
    )

    def formula_2028_08_01(familie, period, parameters):
        p = parameters(period).kibv.einkommen
        me = familie("me_massgebend", period)
        # Anhang: 1 − (ME − MinmE)/(MaxmE − MinmE); Art. 15: bis MinmE 1, über MaxmE 0
        return min_(1, max_(0, 1 - (me - p.min_me) / (p.max_me - p.min_me)))


class altersstufe(Variable):
    value_type = Enum
    possible_values = Altersstufe
    default_value = Altersstufe.AB_18_MONATE_BIS_EINSCHULUNG
    entity = Person
    definition_period = MONTH
    label = "Altersstufe des Kindes für den Höchstbeitrag"
    reference = KIBV_URL
    documentation = "KiBV-14.1 | Art. 14 Abs. 1–3 KiBV | unter 18 Monaten / ab 18 Monaten bis Einschulung / eingeschult (A-04, A-08) | Quellentyp: VERORDNUNG_ENTWURF"

    def formula_2028_08_01(person, period, parameters):
        stufe = person("schulstufe", period)
        # A-04: Kindergarten ist Teil der Volksschule und gilt als eingeschult
        eingeschult = (stufe == Schulstufe.KINDERGARTEN) + (
            stufe == Schulstufe.PRIMARSCHULE
        )
        # A-08: „unter 18 Monaten“ = weniger als 18 vollendete Monate; genau 18 → Abs. 2
        unter_18 = person("alter_monate", period) < 18
        return select(
            [eingeschult, unter_18],
            [Altersstufe.EINGESCHULT, Altersstufe.UNTER_18_MONATE],
            default=Altersstufe.AB_18_MONATE_BIS_EINSCHULUNG,
        )


class anteil_monat_ab_18_monate(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Anteil des Monats, in dem das Kind mindestens 18 Monate alt ist (0 bis 1)"
    reference = KIBV_URL
    documentation = (
        "KiBV-14.2 | Art. 14 Abs. 1 und 2 KiBV | ab dem Tag, an dem das Kind 18 Monate alt ist, gilt Abs. 2 (A-08); "
        "ohne geburtsdatum ganzer Monat nach alter_monate | Quellentyp: VERORDNUNG_ENTWURF"
    )

    def formula_2028_08_01(person, period, parameters):
        geb = person("geburtsdatum", period).astype("datetime64[D]")
        nach_datum = anteil_monat_ab(datum_plus_monate(geb, 18), period)
        nach_alter = person("alter_monate", period) >= 18
        return person("ist_kind", period) * np.where(
            geb != KEIN_DATUM, nach_datum, nach_alter
        )


class hoechstbeitrag_maxv(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Höchster Beitrag je Kind und Betreuungsstunde MaxV (CHF)"
    reference = KIBV_URL
    documentation = "KiBV-14.1 | Art. 14 Abs. 1–3 KiBV | Tabelle Altersstufe × Angebot, 18-Monats-Monat tageweise (A-08); Sonderschule wie schulergänzend (KiBV-14.3.b, A-09); schulergänzend und Sonderschule vor Einschulung 0 (A-11) | Quellentyp: VERORDNUNG_ENTWURF"

    def formula_2028_08_01(person, period, parameters):
        h = parameters(period).kibv.hoechstbeitrag
        ein = person("altersstufe", period) == Altersstufe.EINGESCHULT
        vor = ~ein
        # A-08: im Monat des 18-Monats-Tages tageweise gemischt aus Abs. 1 und Abs. 2
        a = person("anteil_monat_ab_18_monate", period)
        typ = person("angebot_typ", period)
        kita = typ == AngebotTyp.KITA
        tf = typ == AngebotTyp.TAGESFAMILIE
        # A-09: schulergänzende Betreuung einer Sonderschule (KiBG-3.2.d) wie KiBV-14.3.b
        se = (typ == AngebotTyp.SCHULERGAENZEND) + (
            typ == AngebotTyp.SONDERSCHULE_SCHULERGAENZEND
        )
        maxv = select(
            [
                vor * kita,  # KiBV-14.1.a / 14.2.a
                vor * tf,  # KiBV-14.1.b / 14.2.b
                ein * kita,  # KiBV-14.3.a
                ein * se,  # KiBV-14.3.b (auch Sonderschule, A-09)
                ein * tf,  # KiBV-14.3.c
            ],
            [
                (1 - a) * h.unter_18_monate.kita + a * h.ab_18_monate.kita,
                (1 - a) * h.unter_18_monate.tagesfamilie
                + a * h.ab_18_monate.tagesfamilie,
                h.eingeschult.kita,
                h.eingeschult.schulergaenzend,
                h.eingeschult.tagesfamilie,
            ],
            # A-11: schulergänzende Betreuung (auch einer Sonderschule) gibt es erst ab der Einschulung
            default=0,
        )
        return person("ist_kind", period) * maxv


class beitrag_pro_stunde_mindest(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = (
        "Mindestbeitrag je Kind und Betreuungsstunde (ohne Zusatzbeiträge der Gemeinde)"
    )
    reference = GESETZ_URL
    documentation = "KiBG-6.1 | Art. 6 Abs. 1 KiBG, Art. 13 Abs. 1 und Anhang KiBV | MaxV × Einkommensfaktor | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        maxv = person("hoechstbeitrag_maxv", period)
        faktor = person.familie("einkommensfaktor", period)
        return person("ist_kind", period) * maxv * faktor


class beitrag_pro_stunde_total(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Beitrag je Kind und Betreuungsstunde B (inkl. Zusatzbeiträge Z1, Z2 der Gemeinde)"
    reference = KIBV_URL
    documentation = "KiBV-Anh | Anhang, Art. 15 Abs. 2 und Art. 24 Abs. 1 KiBV | B = (MaxV + Z1) × Faktor + Z2; über MaxmE auch kein Z2 (A-10) | Quellentyp: VERORDNUNG_ENTWURF"

    def formula_2028_08_01(person, period, parameters):
        maxv = person("hoechstbeitrag_maxv", period)
        faktor = person.familie("einkommensfaktor", period)
        z1 = person.familie("zusatzbeitrag_z1_pro_stunde", period)
        z2 = person.familie("zusatzbeitrag_z2_pro_stunde", period)
        # A-10: über MaxmE kein Beitrag (KiBV-15.2), also auch kein Z2
        max_me = parameters(period).kibv.einkommen.max_me
        unter_max = person.familie("me_massgebend", period) <= max_me
        # Anhang: B = (MaxV + Z1) × Faktor + Z2
        return person("ist_kind", period) * ((maxv + z1) * faktor + z2 * unter_max)


class subventionierte_stunden_monat(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "hour"
    label = "Subventionierte Betreuungsstunden im Monat"
    reference = KIBV_URL
    documentation = "KiBV-14.4 | Art. 14 Abs. 4 KiBV | höchstens 12 Stunden je Tag und 5 Tage je Woche; Wochen pro Monat AN-01; erst ab drei Monaten (KiBG-4.3) | Quellentyp: VERORDNUNG_ENTWURF"

    def formula_2028_08_01(person, period, parameters):
        u = parameters(period).kibv.umfang
        wochen = parameters(period).anwendung.wochen_pro_monat  # AN-01
        tage = min_(person("betreuungstage_pro_woche", period), u.max_tage_pro_woche)
        stunden = min_(
            person("betreuungsstunden_pro_tag", period), u.max_stunden_pro_tag
        )
        # KiBG-4.3: im Monat, in dem das Kind drei Monate alt wird, nur die Tage ab diesem Tag
        anteil = person("anteil_monat_ab_mindestalter", period)
        return person("ist_kind", period) * tage * stunden * wochen * anteil


class kosten_monat(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Betreuungskosten der EB im Monat (CHF)"
    reference = GESETZ_URL
    documentation = "KiBG-6.2 | Art. 6 Abs. 2 KiBG | Kosten für das in Anspruch genommene Angebot, tatsächliche Stunden (A-06, AN-01) | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        wochen = parameters(period).anwendung.wochen_pro_monat  # AN-01
        stunden_monat = (
            person("betreuungstage_pro_woche", period)
            * person("betreuungsstunden_pro_tag", period)
            * wochen
        )
        return (
            person("ist_kind", period)
            * person("kosten_pro_stunde", period)
            * stunden_monat
        )


class beitrag_mindest_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Mindestbeitrag pro Monat für das Kind (CHF)"
    reference = GESETZ_URL
    documentation = "KiBG-6.1 | Art. 6 Abs. 1 und 2, Art. 20 Abs. 1 KiBG | Mindestbeitrag, höchstens Kosten | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        roh = person("beitrag_pro_stunde_mindest", period) * person(
            "subventionierte_stunden_monat", period
        )
        # Art. 6 Abs. 2: höchstens die Kosten der Erziehungsberechtigten
        return min_(roh, person("kosten_monat", period)) * person(
            "anspruch_kind", period
        )


class beitrag_total_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = (
        "Beitrag total pro Monat für das Kind inkl. Zusatzbeitrag der Gemeinde (CHF)"
    )
    reference = GESETZ_URL
    documentation = "KiBG-20.2 | Art. 20 Abs. 2 und 3 KiBG | Mindest- und Zusatzbeitrag, zusammen höchstens Kosten | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        roh = person("beitrag_pro_stunde_total", period) * person(
            "subventionierte_stunden_monat", period
        )
        # Art. 20 Abs. 3: Mindest- und Zusatzbeitrag zusammen höchstens die Kosten
        return min_(roh, person("kosten_monat", period)) * person(
            "anspruch_kind", period
        )


class anteil_kanton_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Anteil des Kantons am Mindestbeitrag (CHF)"
    reference = GESETZ_URL
    documentation = "KiBG-18.1 | Art. 18 Abs. 1 KiBG | Kanton und Wohnsitzgemeinde tragen die Beiträge hälftig | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        anteil = parameters(period).kibg.finanzierung.anteil_kanton
        return person("beitrag_mindest_kind", period) * anteil


class anteil_gemeinde_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Anteil der Wohnsitzgemeinde am Mindestbeitrag (CHF)"
    reference = GESETZ_URL
    documentation = "KiBG-18.1 | Art. 18 Abs. 1 KiBG | Kanton und Wohnsitzgemeinde tragen die Beiträge hälftig | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        anteil = parameters(period).kibg.finanzierung.anteil_kanton
        return person("beitrag_mindest_kind", period) * (1 - anteil)


class zusatzbeitrag_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Zusatzbeitrag der Gemeinde pro Monat für das Kind (CHF)"
    reference = GESETZ_URL
    documentation = "KiBG-20.2 | Art. 20 Abs. 2 KiBG | Beitrag total − Mindestbeitrag | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        return person("beitrag_total_kind", period) - person(
            "beitrag_mindest_kind", period
        )
