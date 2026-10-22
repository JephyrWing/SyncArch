"""MariaDB type normalization and document round trips; no live DB required."""
from copy import deepcopy
from uuid import uuid4

import pytest

from app.errors import DocumentValidationError
from app.schemas.document_schema import data_type, payload_input


@pytest.mark.parametrize("expression", [
    "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT", "FLOAT", "DOUBLE", "BOOLEAN",
    "INT UNSIGNED", "DECIMAL(65,38) UNSIGNED", "BIT(64)", "CHAR(255)", "VARCHAR(16383)",
    "BINARY(16)", "VARBINARY(65532)", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
    "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB", "DATE", "TIME(0)", "DATETIME(6)", "TIMESTAMP(6)",
    "YEAR", "JSON", "UUID", "INET4", "INET6", "GEOMETRY", "POINT", "LINESTRING", "POLYGON", "MULTIPOINT",
    "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRYCOLLECTION", "ENUM('Active','it''s fine')", "SET('read','write')",
])
def test_type_survives_normalized_document_round_trip(expression):
    column = {"id": str(uuid4()), "name": "value", "dataType": expression}
    payload = {"schemaVersion": 2, "ideas": [], "features": [], "nodes": [], "connections": [],
               "tables": [{"id": str(uuid4()), "name": "sample", "columns": [column]}]}
    before = deepcopy(payload)
    normalized, _ = payload_input(payload)
    again, _ = payload_input(normalized)
    assert normalized == again
    assert payload == before
    actual = normalized["tables"][0]["columns"][0]
    if expression.startswith("ENUM"):
        assert actual["dataType"] == expression
    if expression.startswith("DECIMAL"):
        assert (actual["precision"], actual["scale"]) == (65, 38)


@pytest.mark.parametrize("expression", [
    "VARCHAR(0)", "VARCHAR(16384)", "CHAR(256)", "BIT(65)", "VARBINARY(65533)",
    "TIME(7)", "TIMESTAMP(2,1)", "DECIMAL(2,3)", "DECIMAL(66,2)", "DECIMAL(65,39)",
    "DATE UNSIGNED", "INT(11)", "INT; DROP TABLE users", "ENUM('a'); DROP TABLE users; --",
    "ENUM('a','a')", "SET('a,b')", "ENUM('a\\b')", "ENUM()", "ENUM('unclosed)",
])
def test_invalid_types_are_rejected(expression):
    with pytest.raises(DocumentValidationError):
        data_type({"dataType": expression}, "column", [])


@pytest.mark.parametrize("column", [
    {"dataType": "CHAR(10)", "length": 20},
    {"dataType": "INT", "length": 10},
    {"dataType": "TEXT", "precision": 1},
    {"dataType": "ENUM('a','b')", "length": 10},
    {"dataType": "TIMESTAMP(6)", "precision": 3},
])
def test_stale_or_conflicting_parameters_are_rejected(column):
    with pytest.raises(DocumentValidationError):
        data_type(column, "column", [])
