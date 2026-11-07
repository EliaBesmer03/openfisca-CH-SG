"""Anwendungsschicht: Flags (A6, Wirkung nach A7). Nicht Teil des Rechts.

Wirkung: KEIN → KEIN_ANSPRUCH, FEHLT → ANGABEN_FEHLEN, PRÜFUNG → PRUEFUNG_DURCH_GEMEINDE, Info → kein Einfluss.
Die Flags lesen nur die Rechtsschicht (nie umgekehrt).
"""

import numpy as np
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import (
    gesuchsfristen,
    haushalt_konsistent,
    me_aller_relevanten_personen_bekannt,
)
from openfisca_ch_sg.variables.kibg.enums import (
    AngebotTyp,
    Ausnahmegrund,
    Entscheid,
    HaushaltForm,
    JaNeinUnbekannt,
    Schulstufe,
)

EB = Familie.ERZIEHUNGSBERECHTIGTER

# --- Familie ------------------------------------------------------------------


class flag_wohnsitz_nicht_sg(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Wohnsitz nicht im Kanton St.Gallen"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.1 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(familie, period, parameters):
        return familie("wohnsitz_sg", period) == JaNeinUnbekannt.NEIN


class flag_wohnsitz_unbekannt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Wohnsitz bzw. Wohngemeinde unbekannt"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.1 | nicht Teil des Rechts | Wirkung FEHLT"
    )

    def formula_2028_08_01(familie, period, parameters):
        return familie("wohnsitz_sg", period) == JaNeinUnbekannt.UNBEKANNT


class flag_pensum_unbekannt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Beschäftigungsgrad einer EB oder der gefestigten Partnerin / des gefestigten Partners unbekannt"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.1 | nicht Teil des Rechts | Wirkung FEHLT"
    )

    def formula_2028_08_01(familie, period, parameters):
        bekannt = familie.members("erwerbspensum_bekannt", period)
        gefestigt = familie.members("partner_gefestigt", period)
        getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
        # A-16: bei gefestigter Partnerschaft zählt auch das Pensum des Partners
        partner_unbekannt = getrennt * familie.any(
            ~bekannt * gefestigt, role=Familie.PARTNER
        )
        return familie.any(~bekannt, role=EB) + partner_unbekannt


class flag_haushalt_inkonsistent(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Haushaltsform passt nicht zur Zahl der EB"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.1.b | nicht Teil des Rechts | Wirkung FEHLT"
    )

    def formula_2028_08_01(familie, period, parameters):
        return ~haushalt_konsistent(familie, period)


class flag_pensum_unter_minimum(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Mindestbeschäftigungsgrad nicht erreicht"
    documentation = "ANWENDUNG | erklärt KiBG-4.1.a, KiBG-4.1.b | nicht Teil des Rechts | Wirkung Info"

    def formula_2028_08_01(familie, period, parameters):
        return ~familie("erwerbspensum_erfuellt", period) * ~familie(
            "flag_pensum_unbekannt", period
        )


class flag_ausnahme_kein_grund(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Pensum unter Minimum und kein Ausnahmegrund"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.2, KiBV-12.1 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(familie, period, parameters):
        kein_grund = familie("ausnahmegrund", period) == Ausnahmegrund.KEINER
        return familie("flag_pensum_unter_minimum", period) * kein_grund


class flag_ausnahme_offen(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Entbindung vom Mindestpensum: Entscheid der Gemeinde offen"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.2 | nicht Teil des Rechts | Wirkung PRÜFUNG"
    )

    def formula_2028_08_01(familie, period, parameters):
        grund = familie("ausnahmegrund", period) != Ausnahmegrund.KEINER
        offen = familie("ausnahme_entscheid", period) == Entscheid.OFFEN
        return familie("flag_pensum_unter_minimum", period) * grund * offen


class flag_ausnahme_abgelehnt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Entbindung vom Mindestpensum abgelehnt"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.2 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(familie, period, parameters):
        abgelehnt = familie("ausnahme_entscheid", period) == Entscheid.ABGELEHNT
        return familie("flag_pensum_unter_minimum", period) * abgelehnt


class flag_me_unbekannt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen einer relevanten Person unbekannt"
    documentation = (
        "ANWENDUNG | erklärt KiBG-5.3 | nicht Teil des Rechts | Wirkung FEHLT"
    )

    def formula_2028_08_01(familie, period, parameters):
        return ~me_aller_relevanten_personen_bekannt(familie, period)


class flag_me_aktuell_angewendet(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Aktuelle Gegebenheiten angewendet (Rückgang um mindestens 25 %)"
    documentation = (
        "ANWENDUNG | erklärt KiBV-11.2 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(familie, period, parameters):
        antrag = familie("antrag_aktuelle_gegebenheiten", period)
        abweichend = familie("me_massgebend", period) != familie(
            "me_veranlagung_familie", period
        )
        return antrag * abweichend


class flag_me_aktuell_unter_schwelle(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Antrag gestellt, aber kein Rückgang um wenigstens 25 % (eine Erhöhung zählt nicht)"
    documentation = (
        "ANWENDUNG | erklärt KiBV-11.2 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(familie, period, parameters):
        antrag = familie("antrag_aktuelle_gegebenheiten", period)
        return antrag * ~familie("flag_me_aktuell_angewendet", period)


class flag_partner_nicht_gefestigt(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Partner/in vorhanden, Lebensgemeinschaft nicht gefestigt (Einkommen und Pensum zählen nicht)"
    documentation = (
        "ANWENDUNG | erklärt KiBV-8.2 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(familie, period, parameters):
        gefestigt = familie.members("partner_gefestigt", period)
        return familie.any(~gefestigt, role=Familie.PARTNER)


class flag_pensum_mit_partner(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Gefestigte Partnerschaft: zusammen wenigstens 120 % nötig, Pensum des Partners zählt"
    documentation = "ANWENDUNG | erklärt KiBG-4.1.b, KiBV-8.2, A-16 | nicht Teil des Rechts | Wirkung Info"

    def formula_2028_08_01(familie, period, parameters):
        gefestigt = familie.members("partner_gefestigt", period)
        getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
        return getrennt * familie.any(gefestigt, role=Familie.PARTNER)


class flag_me_ueber_maxme(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen über MaxmE"
    documentation = (
        "ANWENDUNG | erklärt KiBV-15.2 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(familie, period, parameters):
        max_me = parameters(period).kibv.einkommen.max_me
        return familie("me_massgebend", period) > max_me


class flag_verordnung_entwurf(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Werte stammen aus dem Verordnungsentwurf"
    documentation = "ANWENDUNG | erklärt A2 | nicht Teil des Rechts | Wirkung Info"

    def formula_2028_08_01(familie, period, parameters):
        return np.ones(familie.count, dtype=bool)


class flag_zusatzbeitrag_platzhalter(Variable):
    value_type = bool
    entity = Familie
    definition_period = MONTH
    label = "Zusatzbeiträge der Gemeinde sind Platzhalter (0)"
    documentation = (
        "ANWENDUNG | erklärt KiBG-20.2, AN-04 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(familie, period, parameters):
        platzhalter = parameters(period).anwendung.zusatzbeitraege_platzhalter == 1
        return np.full(familie.count, platzhalter, dtype=bool)


# --- Person (Kind) ------------------------------------------------------------


class flag_kind_zu_jung(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Kind jünger als drei Monate"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.3 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(person, period, parameters):
        # erst ab dem Tag, an dem das Kind drei Monate alt ist (A-08)
        return person("ist_kind", period) * (
            person("anteil_monat_ab_mindestalter", period) == 0
        )


class flag_kind_zu_alt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Kind hat die Primarschule abgeschlossen"
    documentation = (
        "ANWENDUNG | erklärt KiBG-4.3 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(person, period, parameters):
        oberstufe = person("schulstufe", period) == Schulstufe.OBERSTUFE_ODER_HOEHER
        return person("ist_kind", period) * oberstufe


class flag_angebot_nicht_anerkannt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Angebot ist keine anerkannte Einrichtung"
    documentation = (
        "ANWENDUNG | erklärt KiBG-3.2 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(person, period, parameters):
        anderes = person("angebot_typ", period) == AngebotTyp.ANDERES
        return person("ist_kind", period) * anderes


class flag_angebot_nicht_angemeldet(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Einrichtung nicht angemeldet"
    documentation = (
        "ANWENDUNG | erklärt KiBG-3.3 | nicht Teil des Rechts | Wirkung KEIN"
    )

    def formula_2028_08_01(person, period, parameters):
        nein = person("angebot_angemeldet", period) == JaNeinUnbekannt.NEIN
        return person("ist_kind", period) * nein


class flag_angebot_anmeldung_unbekannt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Unbekannt, ob die Einrichtung angemeldet ist"
    documentation = (
        "ANWENDUNG | erklärt KiBG-3.3 | nicht Teil des Rechts | Wirkung FEHLT"
    )

    def formula_2028_08_01(person, period, parameters):
        unbekannt = person("angebot_angemeldet", period) == JaNeinUnbekannt.UNBEKANNT
        return person("ist_kind", period) * unbekannt


class flag_kein_hoechstbeitrag(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Schulergänzende Betreuung, auch einer Sonderschule, gibt es erst ab der Einschulung (Eingabe prüfen)"
    documentation = "ANWENDUNG | erklärt KiBV-14.1, A-09, A-11 | nicht Teil des Rechts | Wirkung KEIN"

    def formula_2028_08_01(person, period, parameters):
        # A-11: schulergänzende Betreuung (auch einer Sonderschule, A-09) vor der Einschulung
        anerkannt = person("angebot_typ", period) != AngebotTyp.ANDERES
        ohne_maxv = person("hoechstbeitrag_maxv", period) == 0
        return person("ist_kind", period) * anerkannt * ohne_maxv


class flag_stunden_gekappt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Mehr als 12 Stunden pro Tag oder 5 Tage pro Woche, gekappt"
    documentation = (
        "ANWENDUNG | erklärt KiBV-14.4 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(person, period, parameters):
        u = parameters(period).kibv.umfang
        zu_viele_tage = (
            person("betreuungstage_pro_woche", period) > u.max_tage_pro_woche
        )
        zu_viele_stunden = (
            person("betreuungsstunden_pro_tag", period) > u.max_stunden_pro_tag
        )
        return person("ist_kind", period) * (zu_viele_tage + zu_viele_stunden)


class flag_kostendeckel_greift(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Der Kostendeckel reduziert den Beitrag"
    documentation = (
        "ANWENDUNG | erklärt KiBG-6.2, KiBG-20.3 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(person, period, parameters):
        stunden = person("subventionierte_stunden_monat", period)
        kosten = person("kosten_monat", period)
        roh_total = person("beitrag_pro_stunde_total", period) * stunden
        return person("anspruch_kind", period) * (roh_total > kosten)


class flag_gesuch_verspaetet(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Gesuch mehr als 30 Tage nach Betreuungsbeginn"
    documentation = (
        "ANWENDUNG | erklärt KiBG-9.2 | nicht Teil des Rechts | Wirkung Info"
    )

    def formula_2028_08_01(person, period, parameters):
        frist = parameters(period).kibg.verfahren.frist_rueckwirkung_tage
        _, _, tage = gesuchsfristen(person, period, parameters)
        return person("ist_kind", period) * (tage > frist)


class flag_uebergangsregel(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Übergangsregel KiBV-25.1 angewendet (nicht modelliert, immer false; bleibt für den Vertrag)"
    documentation = "ANWENDUNG | erklärt KiBV-25.1 | nicht Teil des Rechts | Wirkung Info | Übergangsregel vom Rechtsteam ausgeklammert"

    def formula_2028_08_01(person, period, parameters):
        return np.zeros(person.count, dtype=bool)
