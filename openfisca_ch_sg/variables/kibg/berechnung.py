"""Berechnung der Beiträge (Art. 6, 18 und 20 KiBG; Art. 13 bis 15, 24 und Anhang KiBV)."""

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
    label = "Einkommensfaktor nach Anhang KiBV: 1 − (ME − MinmE) / (MaxmE − MinmE), begrenzt auf 0 bis 1"
    reference = KIBV_URL

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

    def formula_2028_08_01(person, period, parameters):
        stufe = person("schulstufe", period)
        # Der Kindergarten ist Teil der Volksschule und gilt als eingeschult (A-04).
        eingeschult = (stufe == Schulstufe.KINDERGARTEN) + (
            stufe == Schulstufe.PRIMARSCHULE
        )
        # „Unter 18 Monaten“ heisst weniger als 18 vollendete Monate; mit genau 18 gilt Art. 14 Abs. 2 KiBV (A-08).
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
    label = "Höchster Beitrag je Kind und Betreuungsstunde MaxV (CHF)"
    reference = KIBV_URL

    def formula_2028_08_01(person, period, parameters):
        h = parameters(period).kibv.hoechstbeitrag
        eingeschult = person("altersstufe", period) == Altersstufe.EINGESCHULT
        angebot = person("angebot_typ", period)
        kita = angebot == AngebotTyp.KITA
        tagesfamilie = angebot == AngebotTyp.TAGESFAMILIE
        # Schulergänzende Betreuung einer Sonderschule (Art. 3 Abs. 2 lit. d KiBG) wie Art. 14 Abs. 3 lit. b KiBV (A-09)
        schulergaenzend = (angebot == AngebotTyp.SCHULERGAENZEND) + (
            angebot == AngebotTyp.SONDERSCHULE_SCHULERGAENZEND
        )

        # Art. 14 Abs. 1 und 2 KiBV: Im Monat, in dem das Kind 18 Monate alt wird, gelten beide
        # Höchstbeiträge tageweise (A-08).
        ab_18 = person("anteil_monat_ab_18_monate", period)
        kita_vor_einschulung = (
            1 - ab_18
        ) * h.unter_18_monate.kita + ab_18 * h.ab_18_monate.kita
        tagesfamilie_vor_einschulung = (
            1 - ab_18
        ) * h.unter_18_monate.tagesfamilie + ab_18 * h.ab_18_monate.tagesfamilie

        hoechstbeitrag = select(
            [
                ~eingeschult * kita,  # Art. 14 Abs. 1 lit. a, Abs. 2 lit. a KiBV
                ~eingeschult
                * tagesfamilie,  # Art. 14 Abs. 1 lit. b, Abs. 2 lit. b KiBV
                eingeschult * kita,  # Art. 14 Abs. 3 lit. a KiBV
                eingeschult * schulergaenzend,  # Art. 14 Abs. 3 lit. b KiBV
                eingeschult * tagesfamilie,  # Art. 14 Abs. 3 lit. c KiBV
            ],
            [
                kita_vor_einschulung,
                tagesfamilie_vor_einschulung,
                h.eingeschult.kita,
                h.eingeschult.schulergaenzend,
                h.eingeschult.tagesfamilie,
            ],
            # Für schulergänzende Betreuung vor der Einschulung nennt Art. 14 KiBV keinen Höchstbeitrag (A-11).
            default=0,
        )
        return person("ist_kind", period) * hoechstbeitrag


class beitrag_pro_stunde_mindest(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = (
        "Mindestbeitrag je Kind und Betreuungsstunde (ohne Zusatzbeiträge der Gemeinde)"
    )
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        maxv = person("hoechstbeitrag_maxv", period)
        faktor = person.familie("einkommensfaktor", period)
        return person("ist_kind", period) * maxv * faktor


class beitrag_pro_stunde_total(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Beitrag je Kind und Betreuungsstunde B (inkl. Zusatzbeiträge Z1, Z2 der Gemeinde)"
    reference = KIBV_URL

    def formula_2028_08_01(person, period, parameters):
        maxv = person("hoechstbeitrag_maxv", period)
        faktor = person.familie("einkommensfaktor", period)
        z1 = person.familie("zusatzbeitrag_z1_pro_stunde", period)
        z2 = person.familie("zusatzbeitrag_z2_pro_stunde", period)
        # Art. 15 Abs. 2 KiBV: über MaxmE kein Beitrag, also auch kein Z2 (A-10)
        max_me = parameters(period).kibv.einkommen.max_me
        unter_max = person.familie("me_massgebend", period) <= max_me
        # Anhang KiBV: B = (MaxV + Z1) × Einkommensfaktor + Z2
        return person("ist_kind", period) * ((maxv + z1) * faktor + z2 * unter_max)


class subventionierte_stunden_monat(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Subventionierte Betreuungsstunden im Monat"
    reference = KIBV_URL

    def formula_2028_08_01(person, period, parameters):
        u = parameters(period).kibv.umfang
        wochen = parameters(
            period
        ).anwendung.wochen_pro_monat  # Annahme: 52 / 12 Wochen pro Monat
        tage = min_(person("betreuungstage_pro_woche", period), u.max_tage_pro_woche)
        stunden = min_(
            person("betreuungsstunden_pro_tag", period), u.max_stunden_pro_tag
        )
        # Art. 4 Abs. 3 KiBG: im Monat, in dem das Kind drei Monate alt wird, nur die Tage ab diesem Tag
        anteil = person("anteil_monat_ab_mindestalter", period)
        return person("ist_kind", period) * tage * stunden * wochen * anteil


class kosten_monat(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Betreuungskosten der Eltern im Monat (CHF)"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        wochen = parameters(
            period
        ).anwendung.wochen_pro_monat  # Annahme: 52 / 12 Wochen pro Monat
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
    label = "Mindestbeitrag pro Monat für das Kind (CHF)"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        roh = person("beitrag_pro_stunde_mindest", period) * person(
            "subventionierte_stunden_monat", period
        )
        # Art. 6 Abs. 2 KiBG: höchstens die Kosten der Erziehungsberechtigten
        return min_(roh, person("kosten_monat", period)) * person(
            "anspruch_kind", period
        )


class beitrag_total_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = (
        "Beitrag total pro Monat für das Kind inkl. Zusatzbeitrag der Gemeinde (CHF)"
    )
    reference = GESETZ_URL

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
    label = "Anteil des Kantons am Mindestbeitrag (CHF)"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        anteil = parameters(period).kibg.finanzierung.anteil_kanton
        return person("beitrag_mindest_kind", period) * anteil


class anteil_gemeinde_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Anteil der Wohnsitzgemeinde am Mindestbeitrag (CHF)"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        anteil = parameters(period).kibg.finanzierung.anteil_kanton
        return person("beitrag_mindest_kind", period) * (1 - anteil)


class zusatzbeitrag_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Zusatzbeitrag der Gemeinde pro Monat für das Kind (CHF)"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        return person("beitrag_total_kind", period) - person(
            "beitrag_mindest_kind", period
        )
