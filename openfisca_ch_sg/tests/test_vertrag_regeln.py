"""Drift-Test Teil 2: contract/regeln.json ↔ Variablen ↔ Parameter ↔ Testnamen.

Schlägt fehl, sobald Rechtsdokumentation und Code auseinanderlaufen, z. B. nach einer
Umbenennung, einer korrigierten Fundstelle oder einem Tippfehler in einem Testnamen.
"""

import glob
import json
import os
import re
from pathlib import Path

import yaml

from openfisca_ch_sg import CountryTaxBenefitSystem

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PAKET = os.path.join(REPO, "openfisca_ch_sg")
REGELN = json.loads(Path(REPO, "contract", "regeln.json").read_text(encoding="utf-8"))
IDS = {r["id"] for r in REGELN}
TBS = CountryTaxBenefitSystem()
ID_MUSTER = re.compile(r"\b(?:KiBG|KiBV)-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*")
UMSETZUNG = {"V", "P", "V, P", "E", "H", "Entität", "–"}
QUELLENTYP = {"GESETZ", "VERORDNUNG_ENTWURF", "ERLAEUTERUNG", "ANNAHME_TEAM"}


def _bekannt(rid):
    """Eine ID ist gültig, wenn es sie gibt oder sie ein Oberbegriff vorhandener IDs ist (KiBG-3.2 → KiBG-3.2.a)."""
    return rid in IDS or any(i.startswith(rid + ".") for i in IDS)


def _parameter():
    for pfad in glob.glob(
        os.path.join(PAKET, "parameters", "**", "*.yaml"), recursive=True
    ):
        name = os.path.relpath(pfad, os.path.join(PAKET, "parameters"))[:-5].replace(
            os.sep, "."
        )
        yield (
            name,
            (yaml.safe_load(Path(pfad).read_text(encoding="utf-8")) or {}).get(
                "metadata", {}
            ),
        )


def test_regeln_sind_vollstaendig_und_eindeutig():
    assert len(IDS) == len(REGELN), "doppelte Regel-ID"
    fehler = []
    for r in REGELN:
        if not r["wortlaut"].strip() or not r["kurztext"]:
            fehler.append(f"{r['id']}: Wortlaut oder Kurztext fehlt")
        if r["umsetzung"] not in UMSETZUNG or r["quellentyp"] not in QUELLENTYP:
            fehler.append(f"{r['id']}: ungültige Umsetzung oder Quellentyp")
        if r["umsetzung"] == "–" and not r["nicht_modelliert_grund"]:
            fehler.append(f"{r['id']}: nicht modelliert ohne Grund")
        if r["umsetzung"] != "–" and not (r["variablen"] or r["parameter"]):
            fehler.append(f"{r['id']}: modelliert, aber ohne Variable oder Parameter")
        if any(not re.fullmatch(r"A-\d\d", a) for a in r["ambiguitaeten"]):
            fehler.append(f"{r['id']}: ungültige Ambiguitäts-ID")
    assert not fehler, "\n".join(fehler)


def test_genannte_variablen_und_parameter_existieren():
    parameter = dict(_parameter())
    fehler = [
        f"{r['id']}: Variable {v} fehlt"
        for r in REGELN
        for v in r["variablen"]
        if v not in TBS.variables
    ]
    fehler += [
        f"{r['id']}: Parameter {p} fehlt"
        for r in REGELN
        for p in r["parameter"]
        if p not in parameter
    ]
    assert not fehler, "\n".join(fehler)


def test_jede_variable_der_rechtsschicht_ist_dokumentiert():
    genannt = {v for r in REGELN for v in r["variablen"]}
    fehler = []
    for name, var in TBS.variables.items():
        if os.path.basename(os.path.dirname(var.introspection_data[0])) != "kibg":
            continue
        rid = (var.documentation or "").split(" | ")[0]
        if not _bekannt(rid):
            fehler.append(f"{name}: Regel-ID {rid} nicht in regeln.json")
        if name not in genannt:
            fehler.append(f"{name}: in keiner Regel unter variablen aufgeführt")
    assert not fehler, "\n".join(fehler)


def test_parameter_haben_metadaten_und_gueltige_regel():
    fehler = []
    zuordnung = {p: r["id"] for r in REGELN for p in r["parameter"]}
    for name, meta in _parameter():
        for feld in ("regel_id", "quellentyp", "reference"):
            if not meta.get(feld):
                fehler.append(f"{name}: metadata.{feld} fehlt")
        ids = [i.strip() for i in str(meta.get("regel_id", "")).split(",") if i.strip()]
        for rid in ids:
            if not (rid.startswith("AN-") or _bekannt(rid)):
                fehler.append(f"{name}: Regel-ID {rid} nicht in regeln.json")
        if not all(i.startswith("AN-") for i in ids) and name not in zuordnung:
            fehler.append(f"{name}: in keiner Regel unter parameter aufgeführt")
    assert not fehler, "\n".join(fehler)


def test_regel_ids_in_testnamen_existieren():
    fehler = []
    for pfad in glob.glob(os.path.join(PAKET, "tests", "**", "*.yaml"), recursive=True):
        for test in yaml.safe_load(Path(pfad).read_text(encoding="utf-8")) or []:
            for rid in ID_MUSTER.findall(test["name"]):
                if not _bekannt(rid):
                    fehler.append(
                        f"{os.path.basename(pfad)}: {rid} in „{test['name'][:60]}“"
                    )
    assert not fehler, "\n".join(fehler)
