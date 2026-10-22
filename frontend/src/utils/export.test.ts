import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSql } from './sqlGenerator.ts';
import { generateMarkdownSpec } from './markdownGenerator.ts';
import type { ErdTable } from '../types/index.ts';
const settings = { dialect: 'mariadb' as const, includeDropTable: true, includeForeignKeys: true, includeIndexes: true, includeComments: true };
const table = (dataType: string, extra = {}): ErdTable => ({ id: 't', name: 'order', x: 0, y: 0,
  comment: "owner's \\ table", relatedFeatureIds: [], columns: [{ id: 'c', name: 'select', dataType,
    isPrimaryKey: true, isForeignKey: false, isNullable: false, isUnique: false, comment: "it's a key", ...extra }] });
test('TC-OUT-02: normalized and inline types, scale zero, UUID and quoted identifiers preserve source', () => {
  for (const [type, fields, expected] of [['VARCHAR', { length: 120 }, 'VARCHAR(120)'], ['DECIMAL', { precision: 12, scale: 0 }, 'DECIMAL(12,0)'], ['DATETIME', { precision: 6 }, 'DATETIME(6)'], ['UUID', {}, 'CHAR(36)'], ['VARCHAR(120)', { length: 120 }, 'VARCHAR(120)']] as const) {
    const source = table(type, fields), before = JSON.stringify(source);
    const sql = generateSql([source], settings, { version: 7, generatedAt: '2026-10-22T00:00:00Z' });
    assert.ok(sql.includes(expected)); assert.ok(sql.includes('CREATE TABLE `order`'));
    assert.ok(sql.includes('`select`')); assert.ok(sql.includes("it''s a key"));
    assert.ok(sql.includes('-- Saved Version: 7')); assert.equal(JSON.stringify(source), before);
  }
});
test('TC-OUT-02: contradictory, irrelevant and invalid type parameters fail explicitly', () => {
  for (const source of [table('VARCHAR(80)', { length: 120 }), table('INT', { length: 9 }), table('VARCHAR'), table('DECIMAL', { scale: 2 }), table('DATETIME', { precision: 7 }), table('UUID', { precision: 4 })]) {
    assert.throws(() => generateSql([source], settings), /order.select/);
  }
  assert.throws(() => generateSql([table('INT', { isForeignKey: true, references: 'missing.id' })], settings), /FK/);
});
test('TC-OUT-01: saved version metadata, escaped cells and empty project never invent example APIs', () => {
  const emptySql = generateSql([], settings, { version: 9, generatedAt: '2026-10-22T00:00:00Z' });
  assert.ok(emptySql.includes('-- Saved Version: 9'));
  assert.ok(emptySql.includes('-- Generated At: 2026-10-22T00:00:00Z'));
  assert.ok(!emptySql.includes('CREATE TABLE'));
  const md = generateMarkdownSpec('Project', '', [], [], [], [], [table('VARCHAR', { length: 120 })], { version: 9, generatedAt: '2026-10-22T00:00:00Z' });
  assert.ok(md.includes('saved version: 9')); assert.ok(md.includes('VARCHAR(120)'));
  assert.ok(!md.includes('사내 SSO 로그인')); assert.ok(md.includes('3.3 통신 연결 속성'));
});
