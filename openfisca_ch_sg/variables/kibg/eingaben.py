"""Rechtsschicht: alle Eingaben aus Teil A, A6 (ohne Formel; alter_monate wird aus geburtsdatum berechnet, wenn nicht eingegeben)."""

from datetime import date

import numpy as np
from openfisca_core.indexed_enums import Enum
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import KEIN_DATUM, monatsgrenzen, vollendete_monate
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

# --- Person: erziehungsberechtigte Person (EB) -------------------------------


class erwerbspensum(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "percent"
    label = "Beschäftigungsgrad in Prozent (0–100): EB und Partner/in in gefestigter Lebensgemeinschaft"
    reference = GESETZ_URL
    documentation = "KiBG-4.1.a | Art. 4 Abs. 1 lit. a und b KiBG | Beschäftigungsgrad aus selbständiger oder unselbständiger Erwerbstätigkeit; zählt bei gefestigter Partnerschaft auch für den Partner (A-16) | Quellentyp: GESETZ"


class erwerbspensum_bekannt(Variable):
    value_type = bool
    default_value = True
    entity = Person
    definition_period = MONTH
    label = "Beschäftigungsgrad ist bekannt (false bei „weiss nicht“)"
    reference = GESETZ_URL
    documentation = "KiBG-4.1 | Art. 4 Abs. 1 KiBG | Angabe zum Beschäftigungsgrad vorhanden | Quellentyp: GESETZ"


# --- Person: EB und Partner/in ------------------------------------------------


class me_veranlagung(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Massgebendes Einkommen und Vermögen laut letzter definitiver Steuerveranlagung (Jahresbetrag, CHF)"
    reference = KIBV_URL
    documentation = (
        "KiBG-5.3 | Art. 5 Abs. 3 KiBG, Art. 9 Abs. 1 und Art. 10 Abs. 1 KiBV | "
        "Wert nach Art. 12 Abs. 2 bzw. Art. 12bis V EG-KVG, wird eingegeben; AN-03 | Quellentyp: GESETZ"
    )


class me_bekannt(Variable):
    value_type = bool
    default_value = True
    entity = Person
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen ist bekannt"
    reference = GESETZ_URL
    documentation = "KiBG-5.3 | Art. 5 Abs. 3 KiBG | Angabe zur Steuerveranlagung vorhanden | Quellentyp: GESETZ"


# --- Person: Partner/in -------------------------------------------------------


class partnerschaft(Variable):
    value_type = Enum
    possible_values = Partnerschaft
    default_value = Partnerschaft.KEINE
    entity = Person
    definition_period = MONTH
    label = "Art der Lebensgemeinschaft der Partnerin / des Partners mit der antragstellenden EB"
    reference = KIBV_URL
    documentation = "KiBV-8.2 | Art. 8 Abs. 2 KiBV | Ehe, eingetragene Partnerschaft oder Konkubinat | Quellentyp: VERORDNUNG_ENTWURF"


class konkubinat_jahre(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "year"
    label = "Dauer des gemeinsamen Haushalts im Konkubinat in Jahren"
    reference = KIBV_URL
    documentation = "KiBV-8.2.b | Art. 8 Abs. 2 lit. b KiBV | gemeinsamer Haushalt seit wenigstens zwei Jahren | Quellentyp: VERORDNUNG_ENTWURF"


# --- Person: Kind -------------------------------------------------------------


class geburtsdatum(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Person
    definition_period = MONTH
    label = "Geburtsdatum des Kindes"
    reference = KIBV_URL
    documentation = (
        "KiBG-4.3 | Art. 4 Abs. 3 KiBG, Art. 14 Abs. 1–2 und Art. 16 Abs. 1 KiBV | Altersgrenzen gelten ab dem Tag, "
        "an dem das Kind 3 bzw. 18 Monate alt ist (A-08); Jahr der Schulpflicht (A-13, AN-06). "
        "Standardwert 1970-01-01 = nicht angegeben, dann gilt alter_monate | Quellentyp: GESETZ"
    )


class alter_monate(Variable):
    value_type = int
    entity = Person
    definition_period = MONTH
    unit = "month"
    label = "Alter des Kindes in vollendeten Monaten am Monatsersten (aus geburtsdatum oder direkt eingegeben)"
    reference = GESETZ_URL
    documentation = "KiBG-4.3 | Art. 4 Abs. 3 KiBG, Art. 14 Abs. 1–2 KiBV | Alter ab drei Monaten; 18-Monats-Grenze A-08 | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        geb = person("geburtsdatum", period).astype("datetime64[D]")
        start, _ = monatsgrenzen(period)
        return np.where(geb != KEIN_DATUM, vollendete_monate(geb, start), 0)


class schulstufe(Variable):
    value_type = Enum
    possible_values = Schulstufe
    default_value = Schulstufe.VORSCHULALTER
    entity = Person
    definition_period = MONTH
    label = "Schulstufe des Kindes"
    reference = GESETZ_URL
    documentation = "KiBG-4.3 | Art. 4 Abs. 3 KiBG, Art. 14 Abs. 2–3 KiBV | bis Abschluss der Primarschule; Kindergarten gilt als eingeschult (A-04) | Quellentyp: GESETZ"


class angebot_typ(Variable):
    value_type = Enum
    possible_values = AngebotTyp
    default_value = AngebotTyp.ANDERES
    entity = Person
    definition_period = MONTH
    label = "Art des genutzten Betreuungsangebots"
    reference = GESETZ_URL
    documentation = "KiBG-3.2 | Art. 3 Abs. 2 lit. a–d KiBG, Art. 2 Abs. 2 KiBG | anerkannte Einrichtungen | Quellentyp: GESETZ"


class angebot_angemeldet(Variable):
    value_type = Enum
    possible_values = JaNeinUnbekannt
    default_value = JaNeinUnbekannt.UNBEKANNT
    entity = Person
    definition_period = MONTH
    label = "Einrichtung ist bei der kantonalen Stelle angemeldet"
    reference = GESETZ_URL
    documentation = "KiBG-3.3 | Art. 3 Abs. 1 und 3 KiBG, Art. 3–5 KiBV | angemeldete Einrichtung als Grundvoraussetzung | Quellentyp: GESETZ"


class betreuungstage_pro_woche(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    label = "Betreuungstage pro Woche während der eigenen Obhut"
    reference = KIBV_URL
    documentation = "KiBV-7.1 | Art. 7 Abs. 1 und Art. 14 Abs. 4 KiBV | nur Tage mit faktischer Obhut der antragstellenden EB | Quellentyp: VERORDNUNG_ENTWURF"


class betreuungsstunden_pro_tag(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "hour"
    label = "Betreuungsstunden pro Betreuungstag"
    reference = KIBV_URL
    documentation = "KiBV-14.4 | Art. 14 Abs. 4 KiBV | höchstens zwölf subventionierte Stunden je Tag | Quellentyp: VERORDNUNG_ENTWURF"


class kosten_pro_stunde(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Betreuungskosten pro Stunde ohne Verpflegung (CHF)"
    reference = GESETZ_URL
    documentation = "KiBG-6.2 | Art. 6 Abs. 2 KiBG | Kosten der EB für das Betreuungsangebot, ohne Verpflegung (A-06) | Quellentyp: GESETZ"


class betreuungsbeginn(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Person
    definition_period = MONTH
    label = "Erster Betreuungstag (Datum der Inanspruchnahme)"
    reference = GESETZ_URL
    documentation = "KiBG-9.2 | Art. 9 Abs. 2 KiBG | Datum der Inanspruchnahme = erster Betreuungstag (A-07) | Quellentyp: GESETZ"


# --- Familie ------------------------------------------------------------------


class wohngemeinde(Variable):
    value_type = Enum
    possible_values = Wohngemeinde
    default_value = Wohngemeinde.UNBEKANNT
    entity = Familie
    definition_period = MONTH
    label = "Politische Gemeinde am zivilrechtlichen Wohnsitz der antragstellenden EB"
    reference = KIBV_URL
    documentation = (
        "KiBV-2.1 | Art. 2 Abs. 1 KiBV, Art. 4 Abs. 1 KiBG | eine der 75 Gemeinden (contract/gemeinden.json, AN-05), "
        "AUSSERKANTONAL oder UNBEKANNT; A-14 | Quellentyp: VERORDNUNG_ENTWURF"
    )


class haushalt_form(Variable):
    value_type = Enum
    possible_values = HaushaltForm
    default_value = HaushaltForm.GEMEINSAMER_HAUSHALT
    entity = Familie
    definition_period = MONTH
    label = "Führen die Erziehungsberechtigten einen gemeinsamen Haushalt?"
    reference = GESETZ_URL
    documentation = "KiBG-4.1.b | Art. 4 Abs. 1 lit. b KiBG, Art. 8 Abs. 1 KiBV | gemeinsamer oder getrennter Haushalt | Quellentyp: GESETZ"


class auslegung_kibg_4_1(Variable):
    value_type = Enum
    possible_values = AuslegungKibg41
    default_value = AuslegungKibg41.NUR_SUMME
    entity = Familie
    definition_period = MONTH
    label = "Auslegungsschalter A-03 zu Art. 4 Abs. 1 KiBG"
    reference = GESETZ_URL
    documentation = "KiBG-4.1 | Art. 4 Abs. 1 lit. a/b KiBG | Lesart A-03: NUR_SUMME (Standard) oder KUMULATIV | Quellentyp: ANNAHME_TEAM"


class ausnahmegrund(Variable):
    value_type = Enum
    possible_values = Ausnahmegrund
    default_value = Ausnahmegrund.KEINER
    entity = Familie
    definition_period = MONTH
    label = "Begründeter Ausnahmefall für die Entbindung vom Mindestpensum"
    reference = KIBV_URL
    documentation = "KiBV-12.1 | Art. 12 Abs. 1 lit. a–c KiBV | abschliessende Liste der Ausnahmegründe (A-01) | Quellentyp: VERORDNUNG_ENTWURF"


class ausnahme_entscheid(Variable):
    value_type = Enum
    possible_values = Entscheid
    default_value = Entscheid.OFFEN
    entity = Familie
    definition_period = MONTH
    label = "Behördenentscheid der Gemeinde über die Entbindung vom Mindestpensum"
    reference = GESETZ_URL
    documentation = "KiBG-4.2 | Art. 4 Abs. 2 KiBG | Ermessen der kommunalen Stelle („kann“), Behördenentscheid als Eingabe | Quellentyp: GESETZ"


class antrag_aktuelle_gegebenheiten(Variable):
    value_type = bool
    default_value = False
    entity = Familie
    definition_period = MONTH
    label = "Antrag auf Bemessung nach aktuellen Gegebenheiten gestellt"
    reference = KIBV_URL
    documentation = "KiBV-11.1 | Art. 11 Abs. 1 KiBV | Bemessung aufgrund aktueller Gegebenheiten nur auf Antrag | Quellentyp: VERORDNUNG_ENTWURF"


class me_aktuell(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Massgebendes Einkommen und Vermögen nach aktuellen Gegebenheiten (Jahresbetrag, CHF)"
    reference = KIBV_URL
    documentation = "KiBG-5.4 | Art. 5 Abs. 4 KiBG, Art. 11 Abs. 2 KiBV | nur mit Antrag relevant, Rückgang um wenigstens 25 % (A-05) | Quellentyp: GESETZ"


class gesuchsdatum(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Familie
    definition_period = MONTH
    label = "Datum des Gesuchs an die kommunale Stelle"
    reference = GESETZ_URL
    documentation = "KiBG-9.1 | Art. 9 Abs. 1 KiBG, Art. 25 Abs. 1 KiBV | Gesuch der Erziehungsberechtigten | Quellentyp: GESETZ"
