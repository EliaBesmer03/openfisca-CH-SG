"""Schnittstelle zum Frontend: Jede vereinbarte Variable existiert mit Typ und Entität, keine Variable zu viel.

Die Liste unten ist die mit dem Frontend vereinbarte Schnittstelle. Ändert sie sich, zuerst hier nachführen.
"""

import os
from datetime import date

from openfisca_core.indexed_enums import Enum

from openfisca_ch_sg import CountryTaxBenefitSystem

P, F = "person", "familie"

A6 = {
    # Eingaben
    "erwerbspensum": (P, float),
    "erwerbspensum_bekannt": (P, bool),
    "me_veranlagung": (P, float),
    "me_bekannt": (P, bool),
    "partnerschaft": (P, Enum),
    "konkubinat_jahre": (P, float),
    "geburtsdatum": (P, date),
    "alter_monate": (P, int),
    "schulstufe": (P, Enum),
    "angebot_typ": (P, Enum),
    "angebot_angemeldet": (P, Enum),
    "betreuungstage_pro_woche": (P, float),
    "betreuungsstunden_pro_tag": (P, float),
    "kosten_pro_stunde": (P, float),
    "betreuungsbeginn": (P, date),
    "wohngemeinde": (F, Enum),
    "haushalt_form": (F, Enum),
    "auslegung_kibg_4_1": (F, Enum),
    "ausnahmegrund": (F, Enum),
    "ausnahme_entscheid": (F, Enum),
    "antrag_aktuelle_gegebenheiten": (F, bool),
    "me_aktuell": (F, float),
    "gesuchsdatum": (F, date),
    # Rechtsschicht
    "ist_kind": (P, bool),
    "ist_erziehungsberechtigt": (P, bool),
    "ist_partner": (P, bool),
    "wohnsitz_sg": (F, Enum),
    "wohnsitz_erfuellt": (F, bool),
    "zusatzbeitrag_z1_pro_stunde": (F, float),
    "zusatzbeitrag_z2_pro_stunde": (F, float),
    "erwerbspensum_erfuellt": (F, bool),
    "ausnahme_pensum_gewaehrt": (F, bool),
    "voraussetzung_erziehungsberechtigte_erfuellt": (F, bool),
    "anteil_monat_ab_mindestalter": (P, float),
    "alter_kind_erfuellt": (P, bool),
    "angebot_erfuellt": (P, bool),
    "anspruch_kind": (P, bool),
    "partner_gefestigt": (P, bool),
    "me_veranlagung_familie": (F, float),
    "me_massgebend": (F, float),
    "einkommensfaktor": (F, float),
    "anteil_monat_ab_18_monate": (P, float),
    "altersstufe": (P, Enum),
    "hoechstbeitrag_maxv": (P, float),
    "beitrag_pro_stunde_mindest": (P, float),
    "beitrag_pro_stunde_total": (P, float),
    "subventionierte_stunden_monat": (P, float),
    "kosten_monat": (P, float),
    "beitrag_mindest_kind": (P, float),
    "beitrag_total_kind": (P, float),
    "anteil_kanton_kind": (P, float),
    "anteil_gemeinde_kind": (P, float),
    "zusatzbeitrag_kind": (P, float),
    "beitrag_ab_datum": (P, date),
    "jahr_schulpflicht": (P, int),
    "verfuegung_dauer_monate": (P, int),
    # Anwendungsschicht
    "pruefstatus_kind": (P, Enum),
    "pruefstatus": (F, Enum),
    "schaetzung_beitrag_total_kind": (P, float),
    "restkosten_kind": (P, float),
    "beitrag_mindest_familie": (F, float),
    "beitrag_total_familie": (F, float),
    "restkosten_familie": (F, float),
}
FLAGS_FAMILIE = [
    "wohnsitz_nicht_sg",
    "wohnsitz_unbekannt",
    "pensum_unbekannt",
    "haushalt_inkonsistent",
    "pensum_unter_minimum",
    "ausnahme_kein_grund",
    "ausnahme_offen",
    "ausnahme_abgelehnt",
    "me_unbekannt",
    "me_aktuell_angewendet",
    "me_aktuell_unter_schwelle",
    "partner_nicht_gefestigt",
    "pensum_mit_partner",
    "me_ueber_maxme",
    "verordnung_entwurf",
    "zusatzbeitrag_platzhalter",
]
FLAGS_PERSON = [
    "kind_zu_jung",
    "kind_zu_alt",
    "angebot_nicht_anerkannt",
    "angebot_nicht_angemeldet",
    "angebot_anmeldung_unbekannt",
    "kein_hoechstbeitrag",
    "stunden_gekappt",
    "kostendeckel_greift",
    "gesuch_verspaetet",
    "uebergangsregel",
]
A6.update({f"flag_{n}": (F, bool) for n in FLAGS_FAMILIE})
A6.update({f"flag_{n}": (P, bool) for n in FLAGS_PERSON})

TBS = CountryTaxBenefitSystem()


def test_alle_variablen_aus_a6_mit_typ_und_entitaet():
    fehler = []
    for name, (entitaet, typ) in A6.items():
        var = TBS.variables.get(name)
        if var is None:
            fehler.append(f"fehlt: {name}")
        elif var.entity.key != entitaet or var.value_type is not typ:
            fehler.append(
                f"{name}: ist {var.entity.key}/{var.value_type.__name__}, soll {entitaet}/{typ.__name__}"
            )
    assert not fehler, "\n".join(fehler)


def test_keine_variable_ausserhalb_von_a6():
    assert sorted(set(TBS.variables) - set(A6)) == []


def test_label_und_quelle():
    """OpenFisca-Konvention: jede Variable hat ein label; Variablen des Rechts verweisen auf ihre Quelle."""
    fehler = []
    for name, var in TBS.variables.items():
        schicht = os.path.basename(os.path.dirname(var.introspection_data[0]))
        if not var.label:
            fehler.append(f"{name}: label fehlt")
        if schicht == "kibg" and not var.reference:
            fehler.append(f"{name}: reference fehlt")
    assert not fehler, "\n".join(fehler)
