import test from 'node:test';
import assert from 'node:assert/strict';
import type { ErdColumn, ErdTable } from '../types/index.ts';
import { foreignKeyTypeSignature, foreignKeyError, foreignKeyColumnUpdateError } from './foreignKeyValidation.ts';

const column = (patch: Partial<ErdColumn> = {}): ErdColumn => ({ id: 'child-id', name: 'parent_id', dataType: 'VARCHAR(36)',
  isPrimaryKey: false, isForeignKey: true, references: 'parents.id', isUnique: false, isNullable: true, comment: '', ...patch });
const table = (id: string, name: string, columns: ErdColumn[]): ErdTable => ({ id, name, columns, comment: '', relatedFeatureIds: [], x: 0, y: 0 });
const fixture = () => [table('p', 'parents', [column({ id: 'pk', name: 'id', isPrimaryKey: true, isForeignKey: false, references: undefined,
  dataType: 'VARCHAR', length: 36 })]), table('c', 'children', [column()])];

test('FK signatures match normalized server fields and aliases, including precision and UNSIGNED', () => {
  const pairs: [Partial<ErdColumn>, Partial<ErdColumn>][] = [
    [{ dataType: 'VARCHAR(36)' }, { dataType: 'VARCHAR', length: 36 }],
    [{ dataType: 'INTEGER' }, { dataType: 'INT' }],
    [{ dataType: 'NUMERIC(12,2) UNSIGNED' }, { dataType: 'DECIMAL UNSIGNED', precision: 12, scale: 2 }],
    [{ dataType: 'TIMESTAMPTZ' }, { dataType: 'DATETIME', precision: 6 }],
    [{ dataType: 'DECIMAL(10)' }, { dataType: 'DECIMAL', precision: 10, scale: 0 }],
    [{ dataType: 'BIT' }, { dataType: 'BIT', length: 1 }],
    [{ dataType: "ENUM('Active', 'inactive')" }, { dataType: "ENUM('Active','inactive')" }],
  ];
  for (const [first, second] of pairs) assert.equal(foreignKeyTypeSignature(column(first)), foreignKeyTypeSignature(column(second)), JSON.stringify(first));
  for (const [first, second] of [['INT', 'BIGINT'], ['INT', 'INT UNSIGNED'], ['UUID', 'CHAR(36)'],
    ['VARCHAR(36)', 'VARCHAR(80)'], ['DECIMAL(12,2)', 'DECIMAL(12,4)'], ['DATETIME', 'DATETIME(0)'],
    ["ENUM('Active','inactive')", "ENUM('active','inactive')"]]) {
    assert.notEqual(foreignKeyTypeSignature(column({ dataType: first })), foreignKeyTypeSignature(column({ dataType: second })));
  }
});

test('link validation explains both types, missing targets and non-unique references', () => {
  const tables = fixture();
  const source = tables[1].columns[0];
  assert.equal(foreignKeyError(tables, tables[1], source), '');
  assert.equal(foreignKeyError(tables, tables[1], { ...source, references: 'PARENTS.ID' }), '');
  const mismatch = foreignKeyError(tables, tables[1], { ...source, dataType: 'INT' });
  assert.ok(mismatch.includes('children.parent_id [INT]'));
  assert.ok(mismatch.includes('parents.id [VARCHAR(36)]'));
  assert.ok(foreignKeyError(tables, tables[1], { ...source, references: '' }).includes('입력'));
  assert.ok(foreignKeyError(tables, tables[1], { ...source, references: 'missing.id' }).includes('없습니다'));
  tables[0].columns[0].isPrimaryKey = false;
  assert.ok(foreignKeyError(tables, tables[1], source).includes('UNIQUE'));
});

test('a second primary key is rejected while preserving existing referenced key', () => {
  const tables = fixture();
  tables[0].columns.push(column({ id: 'other', name: 'other', isForeignKey: false, references: undefined }));
  assert.ok(foreignKeyColumnUpdateError(tables, 'p', 'other', { isPrimaryKey: true }).includes('단일 컬럼 PK'));
  assert.equal(tables[0].columns[0].isPrimaryKey, true);
  assert.equal(tables[0].columns[1].isPrimaryKey, false);
});

test('edits to either end of a linked pair are checked without mutation; disconnect clears the restriction', () => {
  const tables = fixture();
  const before = structuredClone(tables);
  assert.ok(foreignKeyColumnUpdateError(tables, 'c', 'child-id', { dataType: 'INT' }));
  assert.ok(foreignKeyColumnUpdateError(tables, 'p', 'pk', { length: 80 }));
  assert.ok(foreignKeyColumnUpdateError(tables, 'p', 'pk', { isPrimaryKey: false }));
  assert.equal(foreignKeyColumnUpdateError(tables, 'c', 'child-id', { isForeignKey: false, references: undefined }), '');
  assert.equal(foreignKeyColumnUpdateError(tables, 'c', 'child-id', { comment: '설명 수정' }), '');
  assert.deepEqual(tables, before);
});
