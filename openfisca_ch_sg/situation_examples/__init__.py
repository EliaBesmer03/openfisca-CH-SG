"""This file provides a function to load json example situations."""

import json
import os

DIR_PATH = os.path.dirname(os.path.abspath(__file__))


def parse(file_name):
    """Load json example situations."""
    file_path = os.path.join(DIR_PATH, file_name)
    with open(file_path, encoding="utf8") as file:
        return json.loads(file.read())


# Beispielfamilie F1 (gleich wie contract/fixtures/F01_standardfamilie.request.json)
f01_standardfamilie = parse("f01_standardfamilie.json")
