import type { ErdColumn, ErdTable } from '../types/index.ts';
import { columnTypeExpression, normalizeTypeExpression } from './mariadbTypes.ts';

/** [ERD 설계] 화면 표시 대신 저장 스키마의 정규화 결과로 비교한다. */
export const foreignKeyTypeSignature = (column: ErdColumn): string => {
  const raw = normalizeTypeExpression(column.dataType);
  const choice = /^(ENUM|SET)\((.*)\)$/s.exec(raw);
  if (choice) {
    const labels = choice[2].match(/'(?:[^'\\\x00-\x1f]|'')*'/g);
    return JSON.stringify([`${choice[1]}(${labels?.join(',') ?? choice[2]})`, column.length, column.precision, column.scale]);
  }
  const match = /^([A-Z ]+?)(?:\s*\((\d+)(?:\s*,\s*(\d+))?\))?( UNSIGNED)?$/.exec(raw);
  if (!match) return JSON.stringify([raw, column.length, column.precision, column.scale]);
  const alias: Record<string, string> = { INTEGER: 'INT', BOOL: 'BOOLEAN', NUMERIC: 'DECIMAL', DEC: 'DECIMAL', FIXED: 'DECIMAL', 'DOUBLE PRECISION': 'DOUBLE', REAL: 'DOUBLE', TIMESTAMPTZ: 'DATETIME', JSONB: 'JSON' };
  const base = alias[match[1]] ?? match[1];
  let { length, precision, scale } = column;
  if (['CHAR', 'VARCHAR', 'BINARY', 'VARBINARY', 'BIT'].includes(base)) {
    if (match[2] !== undefined) length = Number(match[2]);
    else if (['CHAR', 'BINARY', 'BIT'].includes(base)) length ??= 1;
  } else if (base === 'DECIMAL') {
    if (match[2] !== undefined) { precision = Number(match[2]); scale = Number(match[3] ?? 0); }
    scale ??= 0;
  } else if (['TIME', 'DATETIME', 'TIMESTAMP'].includes(base)) {
    if (match[2] !== undefined) precision = Number(match[2]);
    if (match[1] === 'TIMESTAMPTZ') precision ??= 6;
  }
  return JSON.stringify([base + (match[4] ?? ''), length, precision, scale]);
};

export const resolveForeignKey = (tables: ErdTable[], reference: string): { table: ErdTable; column: ErdColumn } | null => {
  const parts = reference.trim().split('.');
  if (parts.length !== 2) return null;
  const table = tables.find((item) => item.name.toLowerCase() === parts[0].toLowerCase());
  const column = table?.columns.find((item) => item.name.toLowerCase() === parts[1].toLowerCase());
  return table && column ? { table, column } : null;
};

export const foreignKeyError = (tables: ErdTable[], sourceTable: ErdTable, source: ErdColumn): string => {
  if (!source.isForeignKey) return '';
  const reference = source.references?.trim() ?? '';
  if (!reference) return '참조 대상 컬럼을 입력하세요. 예: users.id';
  const target = resolveForeignKey(tables, reference);
  if (!target) return `참조 대상 '${reference}'이 없습니다. 테이블.컬럼 형식으로 입력하세요.`;
  if (!target.column.isPrimaryKey && !target.column.isUnique) return `'${target.table.name}.${target.column.name}'은 PK 또는 UNIQUE 컬럼이어야 합니다.`;
  if (foreignKeyTypeSignature(source) !== foreignKeyTypeSignature(target.column)) {
    return `외래키 타입 불일치: ${sourceTable.name}.${source.name} [${columnTypeExpression(source)}] → ${target.table.name}.${target.column.name} [${columnTypeExpression(target.column)}]. 타입·길이·정밀도·UNSIGNED를 맞춘 뒤 연결하세요.`;
  }
  return '';
};

/** [ERD 설계] 자동 저장 전에 수정한 컬럼 양쪽의 FK를 검사한다. */
export const foreignKeyColumnUpdateError = (tables: ErdTable[], tableId: string, columnId: string, patch: Partial<ErdColumn>): string => {
  if (patch.isPrimaryKey && tables.find((table) => table.id === tableId)?.columns.some((column) => column.id !== columnId && column.isPrimaryKey)) {
    return '단일 컬럼 PK만 지원합니다. 기존 PK를 먼저 해제하세요. 참조 대상은 UNIQUE로 유지할 수 있습니다.';
  }
  if (!['dataType', 'length', 'precision', 'scale', 'isForeignKey', 'references', 'isPrimaryKey', 'isUnique'].some((key) => key in patch)) return '';
  const next = tables.map((table) => table.id !== tableId ? table : { ...table,
    columns: table.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column) });
  for (const table of next) {
    for (const column of table.columns) {
      if (!column.isForeignKey) continue;
      const target = resolveForeignKey(next, column.references ?? '');
      if (column.id !== columnId && target?.column.id !== columnId) continue;
      const issue = foreignKeyError(next, table, column);
      if (issue) return issue;
    }
  }
  return '';
};
