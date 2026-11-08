"""Anspruchsvoraussetzungen: Wohnsitz, Pensum, Ausnahme, Alter des Kindes, Angebot (Art. 3 und 4 KiBG, Art. 12 KiBV)."""

import numpy as np
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import (
    KEIN_DATUM,
    anteil_monat_ab,
    datum_plus_monate,
    einkommen_bekannt,
    haushalt_passt_zu_personen,
    pensum_bekannt,
    zaehlende_personen,
)
from openfisca_ch_sg.quellen import GESETZ_URL
from openfisca_ch_sg.variables.kibg.enums import (
    AngebotTyp,
    AuslegungKibg41,
    Ausnahmegrund,
    Entscheid,
    JaNeinUnbekannt,
    Schulstufe,
)


class wohnsitz_erfuellt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Wohnsitz im Kanton erfüllt"
    reference = GESETZ_URL

    def formula_2028_08_01(familie, period, parameters):
        return familie("wohnsitz_sg", period) == JaNeinUnbekannt.JA


class erwerbspensum_erfuellt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Mindestbeschäftigungsgrad erfüllt"
    reference = GESETZ_URL

    def formula_2028_08_01(familie, period, parameters):
        p = parameters(period).kibg.anspruch
        zaehlt = zaehlende_personen(familie, period)
        pensum = familie.members("erwerbspensum", period)

        anzahl = familie.sum(zaehlt * 1)
        summe = familie.sum(pensum * zaehlt)
        kleinstes = familie.min(np.where(zaehlt, pensum, np.inf))

        # Art. 4 Abs. 1 lit. a KiBG: allein wenigstens 20 Prozent
        allein_erfuellt = summe >= p.mindestpensum_einzeln
        # lit. b: zu zweit zusammen wenigstens 120 Prozent. Lesart KUMULATIV (A-03): zusätzlich jede Person 20 Prozent
        kumulativ = familie("auslegung_kibg_4_1", period) == AuslegungKibg41.KUMULATIV
        jede_person_erfuellt = kleinstes >= p.mindestpensum_einzeln
        zu_zweit_erfuellt = (summe >= p.mindestpensum_gemeinsam) * (
            ~kumulativ + jede_person_erfuellt
        )

        return np.where(anzahl >= 2, zu_zweit_erfuellt, allein_erfuellt)


class ausnahme_pensum_gewaehrt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Entbindung vom Mindestbeschäftigungsgrad gewährt"
    reference = GESETZ_URL

    def formula_2028_08_01(familie, period, parameters):
        # Art. 4 Abs. 2 KiBG: Die Gemeinde „kann“ entbinden. Ihr Entscheid ist eine Eingabe (A-01).
        hat_grund = familie("ausnahmegrund", period) != Ausnahmegrund.KEINER
        bewilligt = familie("ausnahme_entscheid", period) == Entscheid.BEWILLIGT
        return hat_grund * bewilligt


class voraussetzung_erziehungsberechtigte_erfuellt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Voraussetzungen bei den Erziehungsberechtigten erfüllt"
    reference = GESETZ_URL

    def formula_2028_08_01(familie, period, parameters):
        wohnsitz = familie("wohnsitz_erfuellt", period)
        pensum = familie("erwerbspensum_erfuellt", period) + familie(
            "ausnahme_pensum_gewaehrt", period
        )
        angaben_vollstaendig = pensum_bekannt(
            familie, period
        ) * haushalt_passt_zu_personen(familie, period)
        return wohnsitz * pensum * angaben_vollstaendig


class anteil_monat_ab_mindestalter(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = (
        "Anteil des Monats, in dem das Kind mindestens drei Monate alt ist (0 bis 1)"
    )
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        mindestalter = int(parameters(period).kibg.anspruch.mindestalter_monate)
        geburtsdatum = person("geburtsdatum", period).astype("datetime64[D]")
        # Mit Geburtsdatum taggenau ab dem Tag, an dem das Kind drei Monate alt ist (A-08);
        # ohne Geburtsdatum ganzer Monat nach dem eingegebenen Alter.
        nach_datum = anteil_monat_ab(
            datum_plus_monate(geburtsdatum, mindestalter), period
        )
        nach_alter = person("alter_monate", period) >= mindestalter
        anteil = np.where(geburtsdatum != KEIN_DATUM, nach_datum, nach_alter)
        return person("ist_kind", period) * anteil


class alter_kind_erfuellt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = (
        "Altersvoraussetzung des Kindes erfüllt (wenigstens an einem Tag des Monats)"
    )
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        alt_genug = person("anteil_monat_ab_mindestalter", period) > 0
        primarschule_nicht_abgeschlossen = (
            person("schulstufe", period) != Schulstufe.OBERSTUFE_ODER_HOEHER
        )
        return person("ist_kind", period) * alt_genug * primarschule_nicht_abgeschlossen


class angebot_erfuellt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Betreuung in einer anerkannten und angemeldeten Einrichtung"
    reference = GESETZ_URL

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

    def formula_2028_08_01(person, period, parameters):
        kind = person("alter_kind_erfuellt", period) * person(
            "angebot_erfuellt", period
        )
        # Ohne Höchstbeitrag kein Beitrag: schulergänzende Betreuung erst ab Einschulung (A-11)
        hat_hoechstbeitrag = person("hoechstbeitrag_maxv", period) > 0
        eltern = person.familie("voraussetzung_erziehungsberechtigte_erfuellt", period)
        familie = person.simulation.populations["familie"]
        einkommen = familie.project(einkommen_bekannt(familie, period))
        return kind * hat_hoechstbeitrag * eltern * einkommen
