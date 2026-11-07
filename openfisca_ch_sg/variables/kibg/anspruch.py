"""Rechtsschicht: Anspruchsvoraussetzungen (KiBG-3, KiBG-4, KiBV-12)."""

import numpy as np
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import (
    KEIN_DATUM,
    anteil_monat_ab,
    datum_plus_monate,
    haushalt_konsistent,
    me_aller_relevanten_personen_bekannt,
)
from openfisca_ch_sg.quellen import GESETZ_URL
from openfisca_ch_sg.variables.kibg.enums import (
    AngebotTyp,
    AuslegungKibg41,
    Ausnahmegrund,
    Entscheid,
    HaushaltForm,
    JaNeinUnbekannt,
    Schulstufe,
)

EB = Familie.ERZIEHUNGSBERECHTIGTER


class wohnsitz_erfuellt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Wohnsitz im Kanton erfüllt"
    reference = GESETZ_URL
    documentation = "KiBG-4.1 | Art. 4 Abs. 1 KiBG | Erziehungsberechtigte mit zivilrechtlichem Wohnsitz im Kanton | Quellentyp: GESETZ"

    def formula_2028_08_01(familie, period, parameters):
        return familie("wohnsitz_sg", period) == JaNeinUnbekannt.JA


class erwerbspensum_erfuellt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Mindestbeschäftigungsgrad erfüllt"
    reference = GESETZ_URL
    documentation = (
        "KiBG-4.1.a | Art. 4 Abs. 1 lit. a und b KiBG | allein: wenigstens 20 %; gemeinsamer Haushalt der EB "
        "oder EB mit Partner/in in gefestigter Lebensgemeinschaft (A-16): zusammen wenigstens 120 % (Lesart A-03) | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(familie, period, parameters):
        p = parameters(period).kibg.anspruch
        pensum = familie.members("erwerbspensum", period)
        gefestigt = familie.members("partner_gefestigt", period)
        getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
        # A-16: bei getrenntem Haushalt zählt eine Partnerin / ein Partner in gefestigter
        # Lebensgemeinschaft (KiBV-8.2) wie eine zweite Person im gemeinsamen Haushalt
        mit_partner = getrennt * familie.any(gefestigt, role=Familie.PARTNER)
        summe = familie.sum(pensum, role=EB) + mit_partner * familie.sum(
            pensum * gefestigt, role=Familie.PARTNER
        )
        minimum_eb = familie.min(pensum, role=EB)
        # nicht gefestigte Partner/innen fallen aus dem Minimum heraus (1000 % = neutral)
        minimum_partner = familie.min(
            np.where(gefestigt, pensum, 1000), role=Familie.PARTNER
        )
        minimum = np.where(
            mit_partner, np.minimum(minimum_eb, minimum_partner), minimum_eb
        )
        zu_zweit = ~getrennt + mit_partner
        kumulativ = familie("auslegung_kibg_4_1", period) == AuslegungKibg41.KUMULATIV
        # lit. b: zusammen wenigstens 120 %; bei KUMULATIV (A-03) zusätzlich jede Person lit. a
        zu_zweit_erfuellt = (summe >= p.mindestpensum_gemeinsam) * (
            ~kumulativ + (minimum >= p.mindestpensum_einzeln)
        )
        # lit. a: wenigstens 20 % (antragstellende EB allein)
        allein_erfuellt = summe >= p.mindestpensum_einzeln
        return zu_zweit * zu_zweit_erfuellt + ~zu_zweit * allein_erfuellt


class ausnahme_pensum_gewaehrt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Entbindung vom Mindestbeschäftigungsgrad gewährt"
    reference = GESETZ_URL
    documentation = "KiBG-4.2 | Art. 4 Abs. 2 KiBG, Art. 12 Abs. 1 KiBV | Ausnahmegrund vorhanden und Behördenentscheid BEWILLIGT (A-01) | Quellentyp: GESETZ"

    def formula_2028_08_01(familie, period, parameters):
        grund = familie("ausnahmegrund", period) != Ausnahmegrund.KEINER
        bewilligt = familie("ausnahme_entscheid", period) == Entscheid.BEWILLIGT
        return grund * bewilligt


class voraussetzung_erziehungsberechtigte_erfuellt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Voraussetzungen bei den Erziehungsberechtigten erfüllt"
    reference = GESETZ_URL
    documentation = "KiBG-4.1 | Art. 4 Abs. 1 und 2 KiBG | Wohnsitz und (Mindestpensum oder Entbindung), Pensen bekannt (EB und gefestigte/r Partner/in) | Quellentyp: GESETZ"

    def formula_2028_08_01(familie, period, parameters):
        bekannt = familie.members("erwerbspensum_bekannt", period)
        gefestigt = familie.members("partner_gefestigt", period)
        getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
        # A-16: bei gefestigter Partnerschaft muss auch das Pensum des Partners bekannt sein
        pensen_bekannt = familie.all(bekannt, role=EB) * (
            ~getrennt + familie.all(bekannt + ~gefestigt, role=Familie.PARTNER)
        )
        konsistent = haushalt_konsistent(familie, period)  # A-14
        pensum_ok = familie("erwerbspensum_erfuellt", period) + familie(
            "ausnahme_pensum_gewaehrt", period
        )
        return (
            familie("wohnsitz_erfuellt", period)
            * pensen_bekannt
            * konsistent
            * pensum_ok
        )


class anteil_monat_ab_mindestalter(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = (
        "Anteil des Monats, in dem das Kind mindestens drei Monate alt ist (0 bis 1)"
    )
    reference = GESETZ_URL
    documentation = (
        "KiBG-4.3 | Art. 4 Abs. 3 KiBG | Beiträge ab dem Tag, an dem das Kind drei Monate alt ist (A-08); "
        "ohne geburtsdatum ganzer Monat nach alter_monate | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(person, period, parameters):
        mindestalter = parameters(period).kibg.anspruch.mindestalter_monate
        geb = person("geburtsdatum", period).astype("datetime64[D]")
        nach_datum = anteil_monat_ab(datum_plus_monate(geb, int(mindestalter)), period)
        nach_alter = person("alter_monate", period) >= mindestalter
        return person("ist_kind", period) * np.where(
            geb != KEIN_DATUM, nach_datum, nach_alter
        )


class alter_kind_erfuellt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = (
        "Altersvoraussetzung des Kindes erfüllt (wenigstens an einem Tag des Monats)"
    )
    reference = GESETZ_URL
    documentation = "KiBG-4.3 | Art. 4 Abs. 3 KiBG | Kinder ab drei Monaten bis zum Abschluss der Primarschule | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        alt_genug = person("anteil_monat_ab_mindestalter", period) > 0
        primar_nicht_abgeschlossen = (
            person("schulstufe", period) != Schulstufe.OBERSTUFE_ODER_HOEHER
        )
        return person("ist_kind", period) * alt_genug * primar_nicht_abgeschlossen


class angebot_erfuellt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Betreuung in einer anerkannten und angemeldeten Einrichtung"
    reference = GESETZ_URL
    documentation = "KiBG-3.1 | Art. 3 Abs. 1–3 KiBG | anerkannte und angemeldete Einrichtung | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        anerkannt = person("angebot_typ", period) != AngebotTyp.ANDERES
        angemeldet = person("angebot_angemeldet", period) == JaNeinUnbekannt.JA
        return person("ist_kind", period) * anerkannt * angemeldet


class anspruch_kind(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Anspruch auf Beiträge für dieses Kind"
    reference = GESETZ_URL
    documentation = "KiBG-4.1 | Art. 3 und 4 KiBG | alle Anspruchsvoraussetzungen erfüllt und massgebendes Einkommen bekannt | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        # (hoechstbeitrag_maxv > 0) schliesst schulergänzende Betreuung, auch einer
        # Sonderschule, vor der Einschulung aus (A-11)
        hat_hoechstbeitrag = person("hoechstbeitrag_maxv", period) > 0
        eb_erfuellt = person.familie(
            "voraussetzung_erziehungsberechtigte_erfuellt", period
        )
        familie = person.simulation.populations["familie"]
        me_bekannt = familie.project(
            me_aller_relevanten_personen_bekannt(familie, period)
        )
        return (
            person("alter_kind_erfuellt", period)
            * person("angebot_erfuellt", period)
            * hat_hoechstbeitrag
            * eb_erfuellt
            * me_bekannt
        )
