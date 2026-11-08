"""Auswahlwerte der Variablen. Über die API werden sie mit ihrem Namen übergeben (z. B. "JA")."""

from openfisca_core.indexed_enums import Enum

# Generiert aus contract/gemeinden.json (scripts/generate_gemeinden.py), hier nur re-exportiert.
from openfisca_ch_sg.variables.kibg.wohngemeinde_enum import Wohngemeinde  # noqa: F401


class JaNeinUnbekannt(Enum):
    JA = "Ja"
    NEIN = "Nein"
    UNBEKANNT = "Unbekannt"


class HaushaltForm(Enum):
    """Art. 4 Abs. 1 lit. b KiBG, Art. 8 Abs. 1 KiBV."""

    GEMEINSAMER_HAUSHALT = "Erziehungsberechtigte im gemeinsamen Haushalt"
    GETRENNTER_HAUSHALT = (
        "Getrennter Haushalt (nur die antragstellende erziehungsberechtigte Person)"
    )


class AuslegungKibg41(Enum):
    """A-03."""

    NUR_SUMME = "Gemeinsamer Haushalt: Summe der Pensen genügt"
    KUMULATIV = "Gemeinsamer Haushalt: Summe und jede Person mindestens 20 %"


class Ausnahmegrund(Enum):
    """Art. 12 Abs. 1 lit. a–c KiBV."""

    KEINER = "Kein Ausnahmegrund"
    BERUFLICHE_INTEGRATION = "Berufliche Integration (Stellensuche, Aus- und Weiterbildung, Integrationsmassnahmen)"
    FAMILIAERE_BELASTUNG = (
        "Familiäre Belastung (gesundheitliche Beeinträchtigung, Überforderung)"
    )
    INDIKATION_KIND = (
        "Entwicklungs- oder Verhaltensauffälligkeit des Kindes, sprachliche Indikation"
    )


class Entscheid(Enum):
    OFFEN = "Offen"
    BEWILLIGT = "Bewilligt"
    ABGELEHNT = "Abgelehnt"


class Partnerschaft(Enum):
    """Art. 8 Abs. 2 KiBV."""

    KEINE = "Keine Partnerschaft"
    EHE_ODER_EINGETRAGENE_PARTNERSCHAFT = "Ehe oder eingetragene Partnerschaft"
    KONKUBINAT = "Konkubinat"


class Schulstufe(Enum):
    VORSCHULALTER = "Vorschulalter"
    KINDERGARTEN = "Kindergarten"
    PRIMARSCHULE = "Primarschule"
    OBERSTUFE_ODER_HOEHER = "Oberstufe oder höher"


class AngebotTyp(Enum):
    """Art. 3 Abs. 2 lit. a–d KiBG."""

    KITA = "Kindertagesstätte"
    TAGESFAMILIE = "Tagesfamilie (über Tagesfamilienorganisation)"
    SCHULERGAENZEND = "Schulergänzende Betreuung"
    SONDERSCHULE_SCHULERGAENZEND = (
        "Schulergänzende Betreuung einer privaten Sonderschule"
    )
    ANDERES = "Anderes Angebot"


class Altersstufe(Enum):
    """Art. 14 Abs. 1–3 KiBV."""

    UNTER_18_MONATE = "Unter 18 Monaten"
    AB_18_MONATE_BIS_EINSCHULUNG = "Ab 18 Monaten bis zur Einschulung"
    EINGESCHULT = "Eingeschult bis Ende Primarstufe"


class Pruefstatus(Enum):
    """Ergebnis der Prüfung für die Anzeige (nicht Teil des Rechts)."""

    NICHT_IN_KRAFT = "Noch nicht in Kraft"
    KEIN_ANSPRUCH = "Kein Anspruch"
    ANGABEN_FEHLEN = "Angaben fehlen"
    PRUEFUNG_DURCH_GEMEINDE = "Prüfung durch die Gemeinde"
    ANSPRUCH = "Anspruch"
