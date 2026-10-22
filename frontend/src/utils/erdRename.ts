import type { ErdTable } from '../types/index.ts';

export interface FkReference {
  tableId: string;
  tableName: string;
  columnId: string;
  columnName: string;
}

// [ERD 설계] FK 참조는 "table.column" 텍스트로 저장되고(02 설계: 이름 기반 호환 유지)
// erdLinter·sqlGenerator와 같이 대소문자를 구분하지 않고 비교한다.
const parseReference = (reference: string): [string, string] => {
  const [table = '', column = ''] = reference.split('.');
  return [table.trim().toLowerCase(), column.trim().toLowerCase()];
};

/** [ERD 설계] tableName을(컬럼을 주면 tableName.columnName을) 가리키는 FK 컬럼. */
export const findReferences = (tables: ErdTable[], tableName: string, columnName?: string): FkReference[] =>
  tables.flatMap((table) =>
    table.columns
      .filter((col) => {
        if (!col.isForeignKey || !col.references) return false;
        const [refTable, refColumn] = parseReference(col.references);
        return refTable === tableName.toLowerCase() && (columnName === undefined || refColumn === columnName.toLowerCase());
      })
      .map((col) => ({ tableId: table.id, tableName: table.name, columnId: col.id, columnName: col.name }))
  );

const rewriteReferences = (
  tables: ErdTable[],
  matches: (refTable: string, refColumn: string) => boolean,
  rewrite: (refColumn: string) => string
): ErdTable[] =>
  tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => {
      if (!col.isForeignKey || !col.references) return col;
      const [refTable, refColumn] = parseReference(col.references);
      return matches(refTable, refColumn) ? { ...col, references: rewrite(col.references.split('.')[1]?.trim() ?? refColumn) } : col;
    }),
  }));

/** [ERD 설계] 테이블 이름과 그 테이블을 가리키는 모든 FK 참조를 한 번의 문서 변경으로 바꾼다. */
export const renameTable = (tables: ErdTable[], tableId: string, newName: string): ErdTable[] => {
  const target = tables.find((t) => t.id === tableId);
  if (!target) return tables;
  const oldName = target.name.toLowerCase();
  const renamed = tables.map((t) => (t.id === tableId ? { ...t, name: newName } : t));
  return rewriteReferences(renamed, (refTable) => refTable === oldName, (column) => `${newName}.${column}`);
};

/**
 * [ERD 설계] 테이블이나 컬럼을 지우기 전에, 그것을 가리키는 FK 컬럼을 지우지 않고 FK 표시만 해제한다
 * (02 설계 복합 변경 처리). 저장된 문서에 깨진 참조가 남지 않게 하기 위해서다.
 */
export const clearReferences = (tables: ErdTable[], tableName: string, columnName?: string): ErdTable[] => {
  const ids = new Set(findReferences(tables, tableName, columnName).map((ref) => ref.columnId));
  if (ids.size === 0) return tables;
  return tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => (ids.has(col.id) ? { ...col, isForeignKey: false, references: undefined } : col)),
  }));
};

/** [ERD 설계] 컬럼 이름과 그 컬럼을 가리키는 모든 FK 참조를 한 번의 문서 변경으로 바꾼다. */
export const renameColumn = (tables: ErdTable[], tableId: string, columnId: string, newName: string): ErdTable[] => {
  const table = tables.find((t) => t.id === tableId);
  const column = table?.columns.find((c) => c.id === columnId);
  if (!table || !column) return tables;
  const tableName = table.name.toLowerCase();
  const oldName = column.name.toLowerCase();
  const renamed = tables.map((t) =>
    t.id === tableId ? { ...t, columns: t.columns.map((c) => (c.id === columnId ? { ...c, name: newName } : c)) } : t
  );
  return rewriteReferences(
    renamed,
    (refTable, refColumn) => refTable === tableName && refColumn === oldName,
    () => `${table.name}.${newName}`
  );
};
