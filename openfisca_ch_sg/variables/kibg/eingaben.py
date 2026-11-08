"""Eingaben: Angaben der Eltern, die das Modell nicht selbst berechnet (alter_monate wird aus geburtsdatum berechnet, wenn es fehlt)."""

from datetime import date

import numpy as np
from openfisca_core.indexed_enums import Enum
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import KEIN_DATUM, erster_tag, vollendete_monate
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL
from openfisca_ch_sg.variables.kibg.enums import (
    AngebotTyp,
    AuslegungKibg41,
    Ausnahmegrund,
    Entscheid,
    HaushaltForm,
    JaNeinUnbekannt,
    Partnerschaft,
    Schulstufe,
    Wohngemeinde,
)

# --- Person: Erziehungsberechtigte -------------------------------------------


class erwerbspensum(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Beschäftigungsgrad in Prozent (Erziehungsberechtigte und Partnerin oder Partner)"
    reference = GESETZ_URL


class erwerbspensum_bekannt(Variable):
    value_type = bool
    default_value = True
    entity = Person
    definition_period = MONTH
    label = "Beschäftigungsgrad ist bekannt (false bei „weiss nicht“)"
    reference = GESETZ_URL


# --- Person: Erziehungsberechtigte und Partnerin oder Partner ----------------


class me_veranlagung(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen laut letzter definitiver Steuerveranlagung (Jahresbetrag, CHF)"
    reference = KIBV_URL


class me_bekannt(Variable):
    value_type = bool
    default_value = True
    entity = Person
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen ist bekannt"
    reference = GESETZ_URL


# --- Person: Partnerin oder Partner ------------------------------------------


class partnerschaft(Variable):
    value_type = Enum
    possible_values = Partnerschaft
    default_value = Partnerschaft.KEINE
    entity = Person
    definition_period = MONTH
    label = "Art der Lebensgemeinschaft mit der antragstellenden Person"
    reference = KIBV_URL


class konkubinat_jahre(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Dauer des gemeinsamen Haushalts im Konkubinat in Jahren"
    reference = KIBV_URL


# --- Person: Kind -------------------------------------------------------------


class geburtsdatum(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Person
    definition_period = MONTH
    label = "Geburtsdatum des Kindes"
    reference = KIBV_URL


class alter_monate(Variable):
    value_type = int
    entity = Person
    definition_period = MONTH
    label = "Alter des Kindes in vollendeten Monaten am Monatsersten (aus geburtsdatum oder direkt eingegeben)"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        geburtsdatum = person("geburtsdatum", period).astype("datetime64[D]")
        return np.where(
            geburtsdatum != KEIN_DATUM,
            vollendete_monate(geburtsdatum, erster_tag(period)),
            0,
        )


class schulstufe(Variable):
    value_type = Enum
    possible_values = Schulstufe
    default_value = Schulstufe.VORSCHULALTER
    entity = Person
    definition_period = MONTH
    label = "Schulstufe des Kindes"
    reference = GESETZ_URL


class angebot_typ(Variable):
    value_type = Enum
    possible_values = AngebotTyp
    default_value = AngebotTyp.ANDERES
    entity = Person
    definition_period = MONTH
    label = "Art des genutzten Betreuungsangebots"
    reference = GESETZ_URL


class angebot_angemeldet(Variable):
    value_type = Enum
    possible_values = JaNeinUnbekannt
    default_value = JaNeinUnbekannt.UNBEKANNT
    entity = Person
    definition_period = MONTH
    label = "Einrichtung ist bei der kantonalen Stelle angemeldet"
    reference = GESETZ_URL


class betreuungstage_pro_woche(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Betreuungstage pro Woche während der eigenen Obhut"
    reference = KIBV_URL


class betreuungsstunden_pro_tag(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Betreuungsstunden pro Betreuungstag"
    reference = KIBV_URL


class kosten_pro_stunde(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Betreuungskosten pro Stunde ohne Verpflegung (CHF)"
    reference = GESETZ_URL


class betreuungsbeginn(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Person
    definition_period = MONTH
    label = "Erster Betreuungstag (Datum der Inanspruchnahme)"
    reference = GESETZ_URL


# --- Familie ------------------------------------------------------------------


class wohngemeinde(Variable):
    value_type = Enum
    possible_values = Wohngemeinde
    default_value = Wohngemeinde.UNBEKANNT
    entity = Familie
    definition_period = MONTH
    label = (
        "Politische Gemeinde am zivilrechtlichen Wohnsitz der antragstellenden Person"
    )
    reference = KIBV_URL


class haushalt_form(Variable):
    value_type = Enum
    possible_values = HaushaltForm
    default_value = HaushaltForm.GEMEINSAMER_HAUSHALT
    entity = Familie
    definition_period = MONTH
    label = "Führen die Erziehungsberechtigten einen gemeinsamen Haushalt?"
    reference = GESETZ_URL


class auslegung_kibg_4_1(Variable):
    value_type = Enum
    possible_values = AuslegungKibg41
    default_value = AuslegungKibg41.NUR_SUMME
    entity = Familie
    definition_period = MONTH
    label = "Lesart von Art. 4 Abs. 1 KiBG bei gemeinsamem Haushalt: Summe genügt oder zusätzlich jede Person 20 Prozent (A-03)"
    reference = GESETZ_URL


class ausnahmegrund(Variable):
    value_type = Enum
    possible_values = Ausnahmegrund
    default_value = Ausnahmegrund.KEINER
    entity = Familie
    definition_period = MONTH
    label = "Begründeter Ausnahmefall für die Entbindung vom Mindestpensum"
    reference = KIBV_URL


class ausnahme_entscheid(Variable):
    value_type = Enum
    possible_values = Entscheid
    default_value = Entscheid.OFFEN
    entity = Familie
    definition_period = MONTH
    label = "Behördenentscheid der Gemeinde über die Entbindung vom Mindestpensum"
    reference = GESETZ_URL


class antrag_aktuelle_gegebenheiten(Variable):
    value_type = bool
    default_value = False
    entity = Familie
    definition_period = MONTH
    label = "Antrag auf Bemessung nach aktuellen Gegebenheiten gestellt"
    reference = KIBV_URL


class me_aktuell(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen nach aktuellen Gegebenheiten (Jahresbetrag, CHF)"
    reference = KIBV_URL


class gesuchsdatum(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Familie
    definition_period = MONTH
    label = "Datum des Gesuchs an die kommunale Stelle"
    reference = GESETZ_URL
