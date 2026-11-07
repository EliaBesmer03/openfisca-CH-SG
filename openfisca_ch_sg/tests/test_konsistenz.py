"""Konsistenz von Rechts- und Anwendungsschicht über alle YAML-Testsituationen.

Für jedes Kind ab Vollzugsbeginn gilt: anspruch_kind (Recht) ⇔ pruefstatus_kind == ANSPRUCH (Anwendung).
Ausserdem: Beiträge sind nur bei ANSPRUCH grösser als 0.
"""

import glob
import os

import numpy as np
import pytest
import yaml
from openfisca_core.simulation_builder import SimulationBuilder

from openfisca_ch_sg import CountryTaxBenefitSystem
from openfisca_ch_sg.variables.kibg.enums import Pruefstatus

TBS = CountryTaxBenefitSystem()
TEST_DIR = os.path.join(os.path.dirname(__file__), "kibg")


def _faelle():
    for pfad in sorted(glob.glob(os.path.join(TEST_DIR, "*.yaml"))):
        with open(pfad, encoding="utf-8") as datei:
            for test in yaml.safe_load(datei) or []:
                if str(test["period"]) >= "2028-08" and "familien" in test["input"]:
                    yield pytest.param(
                        test, id=f"{os.path.basename(pfad)}: {test['name'][:60]}"
                    )


@pytest.mark.parametrize("test", list(_faelle()))
def test_anspruch_gleich_status_anspruch(test):
    periode = str(test["period"])
    builder = SimulationBuilder()
    builder.set_default_period(periode)
    sim = builder.build_from_entities(TBS, test["input"])
    ist_kind = sim.calculate("ist_kind", periode)
    anspruch = sim.calculate("anspruch_kind", periode)
    status = sim.calculate("pruefstatus_kind", periode)
    beitrag = sim.calculate("beitrag_total_kind", periode)
    status_anspruch = status == Pruefstatus.ANSPRUCH
    assert np.array_equal(anspruch[ist_kind], status_anspruch[ist_kind])
    assert not np.any(beitrag[~status_anspruch] > 0)
