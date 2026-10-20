import type { ErdTable, FeatureSpec, LinterIssue } from '../types/index.ts';

export function runErdLinter(tables: ErdTable[], features: FeatureSpec[]): LinterIssue[] {
  const issues: LinterIssue[] = [];
  const tableNames = new Set(tables.map(t => t.name.toLowerCase()));
  const tableCols = new Map<string, Set<string>>();

  tables.forEach(t => {
    tableCols.set(t.name.toLowerCase(), new Set(t.columns.map(c => c.name.toLowerCase())));
  });

  // Track which tables are referenced or reference others
  const connectedTableNames = new Set<string>();

  tables.forEach(table => {
    let hasOutboundFk = false;

    table.columns.forEach(col => {
      // 1. Check Foreign Key Reference validity
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

      // 2. Check Missing FK Index warning
      if (col.isForeignKey && !col.isPrimaryKey) {
        // Highlighting that FK without index can cause performance bottleneck in joins
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

    // Check if table is completely orphan (unless it's the only table)
    if (tables.length > 1 && !hasOutboundFk && !connectedTableNames.has(table.name.toLowerCase())) {
      // Check if any other table references this table
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

  // 3. Feature Mappings check
  const mappedFeatureIds = new Set<string>();
  tables.forEach(t => t.relatedFeatureIds.forEach(fid => mappedFeatureIds.add(fid)));

  features.forEach(feat => {
    if (!mappedFeatureIds.has(feat.id)) {
      issues.push({
        id: `feat-unmapped-${feat.id}`,
        type: 'feature_missing_table',
        severity: 'info',
        title: `기능 [${feat.id}] 매핑 누락`,
        message: `'${feat.name}' 기능에 대응하는 DB 테이블이 명시적으로 매핑되지 않았습니다.`,
        autoFixType: 'map_feature',
      });
    }
  });

  return issues;
}
