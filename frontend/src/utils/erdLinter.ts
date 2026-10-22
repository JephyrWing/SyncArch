import type { ErdTable, FeatureSpec, LinterIssue } from '../types/index.ts';
import { featureCode } from './features.ts';

export function runErdLinter(tables: ErdTable[], features: FeatureSpec[]): LinterIssue[] {
  const issues: LinterIssue[] = [];
  const tableNames = new Set(tables.map(t => t.name.toLowerCase()));
  const tableCols = new Map<string, Set<string>>();

  tables.forEach(t => {
    tableCols.set(t.name.toLowerCase(), new Set(t.columns.map(c => c.name.toLowerCase())));
  });

  // [ERD 린터] 어떤 테이블이 참조되거나 다른 테이블을 참조하는지 기록한다
  const connectedTableNames = new Set<string>();

  tables.forEach(table => {
    let hasOutboundFk = false;

    table.columns.forEach(col => {
      // [ERD 린터] 1. FK 참조가 유효한지 검사
      if (col.isForeignKey && col.references) {
        hasOutboundFk = true;
        connectedTableNames.add(table.name.toLowerCase());

        const [refTable, refCol] = col.references.split('.');
        if (!refTable || !tableNames.has(refTable.toLowerCase())) {
          issues.push({
            id: `broken-ref-tbl-${table.id}-${col.id}`,
            type: 'broken_fk_ref',
            severity: 'error',
            title: '존재하지 않는 참조 테이블',
            message: `'${table.name}.${col.name}' 컬럼이 참조하는 테이블 '${refTable}'이(가) 스키마에 정의되지 않았습니다.`,
            tableId: table.id,
            tableName: table.name,
            columnId: col.id,
            columnName: col.name,
          });
        } else if (refCol) {
          connectedTableNames.add(refTable.toLowerCase());
          const targetCols = tableCols.get(refTable.toLowerCase());
          if (targetCols && !targetCols.has(refCol.toLowerCase())) {
            issues.push({
              id: `broken-ref-col-${table.id}-${col.id}`,
              type: 'broken_fk_ref',
              severity: 'error',
              title: '존재하지 않는 참조 대상 컬럼',
              message: `'${table.name}.${col.name}' 컬럼이 참조하는 '${refTable}.${refCol}'이 존재하지 않습니다.`,
              tableId: table.id,
              tableName: table.name,
              columnId: col.id,
              columnName: col.name,
            });
          }
        }
      }

      // [ERD 린터] 2. FK 인덱스 누락 경고
      if (col.isForeignKey && !col.isPrimaryKey) {
        // [ERD 린터] 인덱스 없는 FK는 조인 성능 병목이 될 수 있음을 알린다
        issues.push({
          id: `fk-index-${table.id}-${col.id}`,
          type: 'missing_fk_index',
          severity: 'warning',
          title: '외래키(FK) 인덱스 권장',
          message: `'${table.name}.${col.name}' 외래키에 인덱스를 부여하면 JOIN 및 CASCADE 성능이 비약적으로 향상됩니다.`,
          tableId: table.id,
          tableName: table.name,
          columnId: col.id,
          columnName: col.name,
          autoFixType: 'create_index',
        });
      }
    });

    // [ERD 린터] 완전히 고립된 테이블인지 검사한다(테이블이 하나뿐이면 제외)
    if (tables.length > 1 && !hasOutboundFk && !connectedTableNames.has(table.name.toLowerCase())) {
      // [ERD 린터] 다른 테이블이 이 테이블을 참조하는지 검사한다
      const isReferenced = tables.some(other =>
        other.columns.some(c => c.isForeignKey && c.references?.toLowerCase().startsWith(`${table.name.toLowerCase()}.`))
      );
      if (!isReferenced) {
        issues.push({
          id: `orphan-${table.id}`,
          type: 'orphan_table',
          severity: 'warning',
          title: '고립된 테이블(Orphan Table) 감지',
          message: `'${table.name}' 테이블은 다른 어떤 테이블과도 외래키(FK) 관계가 연결되어 있지 않습니다.`,
          tableId: table.id,
          tableName: table.name,
          autoFixType: 'connect_table',
        });
      }
    }
  });

  // [ERD 린터] 3. 기능 매핑 검사
  const mappedFeatureIds = new Set<string>();
  tables.forEach(t => t.relatedFeatureIds.forEach(fid => mappedFeatureIds.add(fid)));

  features.forEach(feat => {
    if (!mappedFeatureIds.has(feat.id)) {
      issues.push({
        id: `feat-unmapped-${feat.id}`,
        type: 'feature_missing_table',
        severity: 'info',
        title: `기능 [${featureCode(feat)}] 매핑 누락`,
        message: `'${feat.name}' 기능에 대응하는 DB 테이블이 명시적으로 매핑되지 않았습니다.`,
        autoFixType: 'map_feature',
      });
    }
  });

  return issues;
}
