import test from 'node:test';
import assert from 'node:assert/strict';
import { MARIADB_TYPES, searchMariaDbTypes, columnTypeExpression, normalizeTypeExpression, mariaDbTypeError, mariaDbTypeParameters, withMariaDbTypeParameters } from './mariadbTypes.ts';
import { generateSql } from './sqlGenerator.ts';
import type { ErdColumn, ErdTable } from '../types/index.ts';

test('MariaDB catalog searches names, aliases and Korean categories and every suggestion is valid', () => {
  assert.equal(new Set(MARIADB_TYPES.map((o) => o.name)).size, MARIADB_TYPES.length);
  for (const option of MARIADB_TYPES) assert.equal(mariaDbTypeError(option.value), '', option.value);
  assert.ok(searchMariaDbTypes('vAr').some((o) => o.name === 'VARCHAR'));
  assert.ok(searchMariaDbTypes('numeric').some((o) => o.name === 'DECIMAL'));
  assert.ok(searchMariaDbTypes('날짜').some((o) => o.name === 'DATE'));
  assert.equal(searchMariaDbTypes('JSONB').length, 0);
});

test('type validation blocks partial searches, malformed values and invalid parameter ranges', () => {
  for (const value of ['VAR', '', 'VARCHAR(0)', 'VARCHAR(16384)', 'CHAR(256)', 'BIT(65)', 'DECIMAL(2,3)', 'DATETIME(7)', 'INT(4)', "ENUM('a'); DROP TABLE users", "SET('a,b')", "ENUM('a','a')", "ENUM('a\\b')"]) {
    assert.ok(mariaDbTypeError(value), value);
  }
  for (const value of ['VARCHAR(16383)', 'BIT(64)', 'DECIMAL(65,38)', 'TIME(0)', "ENUM('Active','it''s fine')", "SET('read','write')"]) assert.equal(mariaDbTypeError(value), '', value);
  assert.equal(normalizeTypeExpression("enum('Active','inactive')"), "ENUM('Active','inactive')");
  assert.equal(mariaDbTypeError('DOUBLE PRECISION'), '');
  assert.equal(normalizeTypeExpression('double precision unsigned'), 'DOUBLE UNSIGNED');
});

test('server-normalized parameters survive display and MariaDB DDL output', () => {
  const specs = [
    { dataType: 'VARCHAR', length: 80 }, { dataType: 'DECIMAL UNSIGNED', precision: 12, scale: 2 },
    { dataType: 'TIMESTAMP', precision: 6 }, { dataType: 'BIT', length: 8 },
    { dataType: "ENUM('Active','inactive')" }, { dataType: 'TEXT' }, { dataType: 'UUID' },
  ];
  const columns: ErdColumn[] = specs.map((spec, index) => ({ id: `c${index}`, name: `col${index}`, ...spec,
    isPrimaryKey: false, isForeignKey: false, isNullable: true, isUnique: false, comment: '' }));
  assert.equal(columnTypeExpression(columns[1]), 'DECIMAL(12,2) UNSIGNED');
  const table: ErdTable = { id: 't', name: 'types_test', comment: '', relatedFeatureIds: [], columns, x: 0, y: 0 };
  const sql = generateSql([table], { dialect: 'mariadb', includeDropTable: false, includeForeignKeys: false, includeIndexes: false, includeComments: false });
  for (const expected of ['VARCHAR(80)', 'DECIMAL(12,2) UNSIGNED', 'TIMESTAMP(6)', 'BIT(8)', "ENUM('Active','inactive')", 'TEXT', 'CHAR(36)']) assert.ok(sql.includes(expected), expected);
});

test('parameter fields reflect normalized columns and retain UNSIGNED when edited', () => {
  assert.deepEqual(mariaDbTypeParameters(columnTypeExpression({ dataType: 'VARCHAR', length: 80 })),
    [{ key: 'length', label: '길이', value: 80, min: 1, max: 16383 }]);
  const decimal = mariaDbTypeParameters('DECIMAL(12,2) UNSIGNED');
  assert.deepEqual(decimal.map((field) => field.value), [12, 2]);
  assert.equal(withMariaDbTypeParameters('DECIMAL(12,2) UNSIGNED', ['14', '4']), 'DECIMAL(14,4) UNSIGNED');
  assert.equal(withMariaDbTypeParameters('DATETIME(6)', ['0']), 'DATETIME(0)');
  assert.equal(mariaDbTypeParameters('TIMESTAMP')[0].value, 0);
  for (const type of ['INT', 'JSON', 'UUID', "ENUM('a','b')"]) assert.deepEqual(mariaDbTypeParameters(type), []);
});
