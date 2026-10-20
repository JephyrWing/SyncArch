import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTablesTopologically, generateSql } from './sqlGenerator.ts';
import { runErdLinter } from './erdLinter.ts';
import type { ErdTable, FeatureSpec } from '../types/index.ts';

const mockTables: ErdTable[] = [
  {
    id: 't-attendances',
    name: 'attendances',
    comment: '출석 기록 테이블',
    relatedFeatureIds: ['FEAT-03'],
    x: 0,
    y: 0,
    columns: [
      { id: 'c1', name: 'id', dataType: 'UUID', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, comment: 'ID' },
      { id: 'c2', name: 'study_id', dataType: 'UUID', isPrimaryKey: false, isForeignKey: true, references: 'studies.id', isUnique: false, isNullable: false, comment: '스터디 ID' },
      { id: 'c3', name: 'user_id', dataType: 'UUID', isPrimaryKey: false, isForeignKey: true, references: 'users.id', isUnique: false, isNullable: false, comment: '유저 ID' },
    ],
  },
  {
    id: 't-users',
    name: 'users',
    comment: '사내 임직원 사용자 테이블',
    relatedFeatureIds: ['FEAT-01'],
    x: 0,
    y: 0,
    columns: [
      { id: 'u1', name: 'id', dataType: 'UUID', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, comment: 'ID' },
      { id: 'u2', name: 'email', dataType: 'VARCHAR(100)', isPrimaryKey: false, isForeignKey: false, isUnique: true, isNullable: false, comment: '이메일' },
    ],
  },
  {
    id: 't-studies',
    name: 'studies',
    comment: '개설된 스터디 모임',
    relatedFeatureIds: ['FEAT-02'],
    x: 0,
    y: 0,
    columns: [
      { id: 's1', name: 'id', dataType: 'UUID', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, comment: 'ID' },
      { id: 's2', name: 'leader_id', dataType: 'UUID', isPrimaryKey: false, isForeignKey: true, references: 'users.id', isUnique: false, isNullable: false, comment: '스터디장 ID' },
    ],
  },
];

test('sortTablesTopologically places parent tables before dependent children', () => {
  const sorted = sortTablesTopologically(mockTables);
  const names = sorted.map(t => t.name);

  // 'users' must come before 'studies' (studies references users)
  assert.ok(names.indexOf('users') < names.indexOf('studies'), 'users must precede studies');
  // 'studies' and 'users' must come before 'attendances' (attendances references both)
  assert.ok(names.indexOf('users') < names.indexOf('attendances'), 'users must precede attendances');
  assert.ok(names.indexOf('studies') < names.indexOf('attendances'), 'studies must precede attendances');
});

test('generateSql creates proper PostgreSQL DDL with Foreign Keys and Indexes', () => {
  const ddl = generateSql(mockTables, {
    dialect: 'postgres',
    includeDropTable: true,
    includeForeignKeys: true,
    includeIndexes: true,
    includeComments: true,
  });

  assert.ok(ddl.includes('DROP TABLE IF EXISTS attendances CASCADE;'));
  assert.ok(ddl.includes('CREATE TABLE users ('));
  assert.ok(ddl.includes('CONSTRAINT fk_attendances_study_id FOREIGN KEY (study_id) REFERENCES studies(id)'));
  assert.ok(ddl.includes('CREATE INDEX idx_attendances_study_id ON attendances (study_id);'));
  assert.ok(ddl.includes("COMMENT ON TABLE users IS '사내 임직원 사용자 테이블';"));
});

test('runErdLinter flags broken foreign key references and missing table mappings', () => {
  const brokenTables: ErdTable[] = [
    {
      id: 't-test',
      name: 'broken_table',
      comment: '테스트용',
      relatedFeatureIds: [],
      x: 0,
      y: 0,
      columns: [
        { id: 'b1', name: 'id', dataType: 'UUID', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, comment: 'PK' },
        { id: 'b2', name: 'unknown_fk', dataType: 'UUID', isPrimaryKey: false, isForeignKey: true, references: 'non_existent_table.id', isUnique: false, isNullable: false, comment: '잘못된 참조' },
      ],
    },
  ];

  const features: FeatureSpec[] = [
    {
      id: 'FEAT-99',
      domain: '결제',
      name: '결제 연동',
      priority: 'P0',
      assignee: '지훈',
      method: 'POST',
      endpoint: '/pay',
      requestFields: 'amount',
      responseFields: 'status',
      summary: '결제',
      status: 'PLANNED',
    },
  ];

  const issues = runErdLinter(brokenTables, features);
  
  const hasBrokenRef = issues.some(i => i.type === 'broken_fk_ref');
  const hasUnmapped = issues.some(i => i.type === 'feature_missing_table');

  assert.equal(hasBrokenRef, true, 'Should detect broken foreign key reference');
  assert.equal(hasUnmapped, true, 'Should detect unmapped feature FEAT-99');
});
