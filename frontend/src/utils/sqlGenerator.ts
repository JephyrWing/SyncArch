import type { ErdTable, ExportSettings, SqlDialect } from '../types/index.ts';
import { columnTypeExpression, normalizeTypeExpression, mariaDbTypeError } from './mariadbTypes.ts';

/**
 * [SQL 생성] FK 참조를 기준으로 테이블을 위상 정렬한다.
 * 참조되는 부모 테이블이 참조하는 자식 테이블보다 먼저 온다.
 */
export function sortTablesTopologically(tables: ErdTable[]): ErdTable[] {
  const tableMap = new Map<string, ErdTable>();
  tables.forEach(t => tableMap.set(t.name.toLowerCase(), t));

  // [SQL 생성] 의존 그래프 구성: 테이블 -> 참조하는 부모 테이블 이름 배열
  const dependencies = new Map<string, Set<string>>();
  tables.forEach(t => {
    const parentSet = new Set<string>();
    t.columns.forEach(col => {
      if (col.isForeignKey && col.references) {
        const [refTable] = col.references.split('.');
        if (refTable && refTable.toLowerCase() !== t.name.toLowerCase() && tableMap.has(refTable.toLowerCase())) {
          parentSet.add(refTable.toLowerCase());
        }
      }
    });
    dependencies.set(t.name.toLowerCase(), parentSet);
  });

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: ErdTable[] = [];

  function visit(tableName: string) {
    if (visited.has(tableName)) return;
    if (visiting.has(tableName)) {
      // [SQL 생성] 순환 참조를 발견하면 멈추지 않고 순환을 끊는다
      return;
    }
    visiting.add(tableName);

    const parents = dependencies.get(tableName);
    if (parents) {
      parents.forEach(parent => {
        if (tableMap.has(parent)) {
          visit(parent);
        }
      });
    }

    visiting.delete(tableName);
    visited.add(tableName);
    const tableObj = tableMap.get(tableName);
    if (tableObj) {
      sorted.push(tableObj);
    }
  }

  tables.forEach(t => visit(t.name.toLowerCase()));

  // [SQL 생성] 빠진 테이블이 있으면 추가한다(예: 고립 테이블)
  tables.forEach(t => {
    if (!sorted.some(s => s.id === t.id)) {
      sorted.push(t);
    }
  });

  return sorted;
}

/**
 * [SQL 생성] 표준 데이터 타입을 DBMS별 타입으로 바꾼다
 */
function mapDataType(type: string, dialect: SqlDialect): string {
  const upper = normalizeTypeExpression(type);
  
  if (dialect === 'postgres') {
    return upper;
  }
  
  if (dialect === 'mysql' || dialect === 'mariadb') {
    if (upper === 'UUID') return dialect === 'mariadb' ? 'CHAR(36)' : 'VARCHAR(36)';
    if (upper === 'TIMESTAMPTZ') return 'DATETIME(6)';
    if (upper === 'BOOLEAN') return 'TINYINT(1)';
    if (upper === 'TEXT') return dialect === 'mariadb' ? 'TEXT' : 'LONGTEXT';
    if (upper === 'JSONB') return 'JSON';
    return upper;
  }

  if (dialect === 'oracle') {
    if (upper === 'UUID') return 'VARCHAR2(36)';
    if (upper.startsWith('VARCHAR')) return upper.replace('VARCHAR', 'VARCHAR2');
    if (upper === 'TEXT') return 'CLOB';
    if (upper === 'JSONB' || upper === 'JSON') return 'CLOB';
    if (upper === 'TIMESTAMPTZ') return 'TIMESTAMP WITH TIME ZONE';
    if (upper === 'DATE') return 'DATE';
    if (upper === 'BOOLEAN') return 'NUMBER(1)';
    if (upper === 'BIGINT') return 'NUMBER(19)';
    if (upper === 'INTEGER' || upper === 'INT') return 'NUMBER(10)';
    return upper;
  }

  if (dialect === 'mssql') {
    if (upper === 'UUID') return 'UNIQUEIDENTIFIER';
    if (upper.startsWith('VARCHAR')) return upper.replace('VARCHAR', 'NVARCHAR');
    if (upper === 'TEXT') return 'NVARCHAR(MAX)';
    if (upper === 'JSONB' || upper === 'JSON') return 'NVARCHAR(MAX)';
    if (upper === 'TIMESTAMPTZ') return 'DATETIMEOFFSET';
    if (upper === 'DATE') return 'DATE';
    if (upper === 'BOOLEAN') return 'BIT';
    if (upper === 'BIGINT') return 'BIGINT';
    if (upper === 'INTEGER' || upper === 'INT') return 'INT';
    return upper;
  }

  if (dialect === 'sqlite') {
    if (upper.includes('INT')) return 'INTEGER';
    if (upper === 'UUID' || upper.includes('VARCHAR') || upper === 'TEXT') return 'TEXT';
    if (upper === 'BOOLEAN') return 'INTEGER';
    if (upper.includes('TIME') || upper.includes('DATE')) return 'TEXT';
    if (upper.includes('JSON')) return 'TEXT';
    return upper;
  }

  return upper;
}

/**
 * [SQL 생성] 옵션과 선택한 DBMS에 맞춰 SQL DDL 또는 Prisma 스키마를 만든다
 */
export function generateSql(tables: ErdTable[], settings: ExportSettings, metadata?: { version: number; generatedAt: string }): string {
  const maria = settings.dialect === 'mariadb';
  const quote = (name: string) => maria ? '`' + name.replace(/`/g, '``') + '`' : name;
  const comment = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "''");
  if (maria) {
    for (const table of tables) for (const column of table.columns) {
      const expression = columnTypeExpression(column);
      const error = mariaDbTypeError(expression);
      const inline = /\((\d+)(?:,\s*(\d+))?\)/.exec(column.dataType);
      const conflict = inline && ((column.length !== undefined && Number(inline[1]) !== column.length)
        || (column.precision !== undefined && Number(inline[1]) !== column.precision)
        || (column.scale !== undefined && Number(inline[2] ?? 0) !== column.scale));
      const base = column.dataType.replace(/\(.*\)/s, '').replace(/ UNSIGNED$/i, '').toUpperCase();
      const wrongParameters = (column.length !== undefined && !['CHAR', 'VARCHAR', 'BINARY', 'VARBINARY', 'BIT'].includes(base))
        || ((column.precision !== undefined || column.scale !== undefined) && !['DECIMAL', 'DEC', 'NUMERIC', 'FIXED', 'DATETIME', 'TIME', 'TIMESTAMP'].includes(base))
        || (column.scale !== undefined && column.precision === undefined);
      if (error || conflict || wrongParameters) throw new Error(`${table.name}.${column.name}: ${error || '자료형 매개변수가 일치하지 않습니다.'}`);
      if (settings.includeForeignKeys && column.isForeignKey) {
        const [name, field] = (column.references ?? '').split('.');
        const parent = tables.find(t => t.name.toLowerCase() === name?.toLowerCase());
        if (!parent?.columns.some(c => c.name.toLowerCase() === field?.toLowerCase())) throw new Error(`${table.name}.${column.name}: FK 참조를 찾을 수 없습니다.`);
      }
    }
  }
  if (tables.length === 0) return '-- 정의된 테이블이 없습니다.';

  if (settings.dialect === 'prisma') {
    return generatePrismaSchema(tables);
  }

  const sortedTables = sortTablesTopologically(tables);
  const lines: string[] = [];
  const dbmsTitleMap: Record<SqlDialect, string> = {
    postgres: 'PostgreSQL 16',
    mysql: 'MySQL 8.0',
    mariadb: 'MariaDB 11.x',
    oracle: 'Oracle Database 19c/21c',
    mssql: 'Microsoft SQL Server (T-SQL)',
    sqlite: 'SQLite 3',
    prisma: 'Prisma Schema DSL'
  };

  lines.push(`-- ==============================================================`);
  lines.push(`-- SyncArch Auto-generated DDL Script`);
  lines.push(`-- Target DBMS: ${dbmsTitleMap[settings.dialect] || settings.dialect.toUpperCase()}`);
  lines.push(`-- Generated At: ${metadata?.generatedAt ?? new Date().toISOString()}`);
  if (metadata) lines.push(`-- Saved Version: ${metadata.version}`);
  lines.push(`-- ==============================================================\n`);

  if (settings.dialect === 'mysql' || settings.dialect === 'mariadb') {
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  } else if (settings.dialect === 'sqlite') {
    lines.push(`PRAGMA foreign_keys = ON;\n`);
  }

  // [SQL 생성] 1. 기존 테이블 삭제
  if (settings.includeDropTable) {
    lines.push(`-- 1. DROP EXISTING TABLES (Reverse Dependency Order)`);
    const reverseTables = [...sortedTables].reverse();
    reverseTables.forEach(t => {
      if (settings.dialect === 'postgres') {
        lines.push(`DROP TABLE IF EXISTS ${t.name} CASCADE;`);
      } else if (settings.dialect === 'mysql' || settings.dialect === 'mariadb' || settings.dialect === 'sqlite') {
        lines.push(`DROP TABLE IF EXISTS ${quote(t.name)};`);
      } else if (settings.dialect === 'oracle') {
        lines.push(`BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${t.name.toUpperCase()} CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;\n/`);
      } else if (settings.dialect === 'mssql') {
        lines.push(`IF OBJECT_ID('dbo.${t.name}', 'U') IS NOT NULL DROP TABLE dbo.${t.name};`);
      }
    });
    if (settings.dialect === 'mssql') {
      lines.push('GO\n');
    } else {
      lines.push('');
    }
  }

  // [SQL 생성] 2. 테이블 생성
  lines.push(`-- 2. CREATE TABLES`);
  sortedTables.forEach(table => {
    const tableName = settings.dialect === 'oracle' ? table.name.toUpperCase() : table.name;
    lines.push(`-- Table: ${tableName} (${table.comment || '설명 없음'})`.replace(/[\r\n]/g, ' '));
    
    if (settings.dialect === 'mssql') {
      lines.push(`CREATE TABLE dbo.${tableName} (`);
    } else {
      lines.push(`CREATE TABLE ${quote(tableName)} (`);
    }

    const colDefinitions: string[] = [];
    const pkCols: string[] = [];
    const fkConstraints: string[] = [];

    table.columns.forEach(col => {
      const colName = settings.dialect === 'oracle' ? col.name.toUpperCase() : col.name;
      let mappedType = mapDataType(columnTypeExpression(col), settings.dialect);
      let def = `    ${quote(colName).padEnd(16)} ${mappedType}`;

      if (col.isPrimaryKey) {
        pkCols.push(quote(colName));
        if (settings.dialect === 'oracle' && col.dataType.toUpperCase().includes('INT')) {
          def += ' GENERATED ALWAYS AS IDENTITY';
        }
      }
      if (!col.isNullable) {
        def += ' NOT NULL';
      }
      if (col.isUnique && !col.isPrimaryKey) {
        def += ' UNIQUE';
      }
      if (col.defaultValue && col.defaultValue.trim() !== '') {
        let defaultVal = col.defaultValue;
        if (settings.dialect === 'oracle' && defaultVal === 'CURRENT_TIMESTAMP') {
          defaultVal = 'SYSTIMESTAMP';
        } else if (settings.dialect === 'mssql' && defaultVal === 'CURRENT_TIMESTAMP') {
          defaultVal = 'SYSUTCDATETIME()';
        }
        def += ` DEFAULT ${defaultVal}`;
      }

      // [SQL 생성] MySQL/MariaDB 인라인 COMMENT 지원
      if ((settings.dialect === 'mysql' || settings.dialect === 'mariadb') && settings.includeComments && col.comment) {
        def += ` COMMENT '${comment(col.comment)}'`;
      }

      colDefinitions.push(def);

      // [SQL 생성] 외래 키
      if (settings.includeForeignKeys && col.isForeignKey && col.references) {
        const [refTableRaw, refColRaw] = col.references.split('.');
        const refTable = settings.dialect === 'oracle' ? refTableRaw.toUpperCase() : refTableRaw;
        const refCol = settings.dialect === 'oracle' ? refColRaw.toUpperCase() : refColRaw;
        
        if (refTable && refCol) {
          const fkName = `fk_${tableName}_${colName}`;
          if (settings.dialect === 'mssql') {
            fkConstraints.push(
              `    CONSTRAINT ${fkName} FOREIGN KEY (${colName}) REFERENCES dbo.${refTable}(${refCol}) ON DELETE CASCADE`
            );
          } else {
            fkConstraints.push(
              `    CONSTRAINT ${quote(fkName)} FOREIGN KEY (${quote(colName)}) REFERENCES ${quote(refTable)}(${quote(refCol)}) ON DELETE CASCADE`
            );
          }
        }
      }
    });

    // [SQL 생성] 기본 키 제약
    if (pkCols.length > 0) {
      colDefinitions.push(`    CONSTRAINT ${quote(`pk_${tableName}`)} PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // [SQL 생성] 외래 키 추가
    colDefinitions.push(...fkConstraints);

    lines.push(colDefinitions.join(',\n'));
    
    if (settings.dialect === 'mysql' || settings.dialect === 'mariadb') {
      if (settings.includeComments && table.comment) {
        lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${comment(table.comment)}';\n`);
      } else {
        lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`);
      }
    } else {
      lines.push(`);\n`);
    }

    // [SQL 생성] PostgreSQL·Oracle 주석
    if ((settings.dialect === 'postgres' || settings.dialect === 'oracle') && settings.includeComments) {
      if (table.comment) {
        lines.push(`COMMENT ON TABLE ${tableName} IS '${table.comment.replace(/'/g, "''")}';`);
      }
      table.columns.forEach(c => {
        const cName = settings.dialect === 'oracle' ? c.name.toUpperCase() : c.name;
        if (c.comment) {
          lines.push(`COMMENT ON COLUMN ${tableName}.${cName} IS '${c.comment.replace(/'/g, "''")}';`);
        }
      });
      lines.push('');
    }

    if (settings.dialect === 'mssql') {
      lines.push('GO\n');
    }
  });

  // [SQL 생성] 3. 인덱스
  if (settings.includeIndexes) {
    lines.push(`-- 3. CREATE PERFORMANCE & FOREIGN KEY INDEXES`);
    sortedTables.forEach(table => {
      const tableName = settings.dialect === 'oracle' ? table.name.toUpperCase() : table.name;
      table.columns.forEach(col => {
        const colName = settings.dialect === 'oracle' ? col.name.toUpperCase() : col.name;
        if (col.isForeignKey && !col.isPrimaryKey) {
          if (settings.dialect === 'mssql') {
            lines.push(`CREATE NONCLUSTERED INDEX idx_${tableName}_${colName} ON dbo.${tableName} (${colName});`);
          } else if (settings.dialect === 'sqlite') {
            lines.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${colName} ON ${tableName} (${colName});`);
          } else {
            lines.push(`CREATE INDEX ${quote(`idx_${tableName}_${colName}`)} ON ${quote(tableName)} (${quote(colName)});`);
          }
        }
      });
    });
    if (settings.dialect === 'mssql') {
      lines.push('GO\n');
    } else {
      lines.push('');
    }
  }

  if (settings.dialect === 'mysql' || settings.dialect === 'mariadb') {
    lines.push(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  }

  return lines.join('\n');
}

/**
 * [SQL 생성] Prisma 스키마 DSL을 만든다
 */
function generatePrismaSchema(tables: ErdTable[]): string {
  const lines: string[] = [];
  lines.push(`// This is your Prisma schema file,`);
  lines.push(`// generated by SyncArch Co-Architect.\n`);
  lines.push(`datasource db {`);
  lines.push(`  provider = "postgresql"`);
  lines.push(`  url      = env("DATABASE_URL")`);
  lines.push(`}\n`);
  lines.push(`generator client {`);
  lines.push(`  provider = "prisma-client-js"`);
  lines.push(`}\n`);

  function toPascalCase(str: string): string {
    return str.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  }

  function mapPrismaType(type: string): string {
    const upper = type.toUpperCase();
    if (upper.includes('INT')) return 'Int';
    if (upper === 'UUID') return 'String @default(uuid())';
    if (upper.includes('VARCHAR') || upper === 'TEXT') return 'String';
    if (upper === 'BOOLEAN') return 'Boolean';
    if (upper.includes('TIME') || upper.includes('DATE')) return 'DateTime';
    if (upper === 'JSONB' || upper === 'JSON') return 'Json';
    return 'String';
  }

  tables.forEach(table => {
    lines.push(`/// ${table.comment || table.name}`);
    lines.push(`model ${toPascalCase(table.name)} {`);

    table.columns.forEach(col => {
      let typeDef = mapPrismaType(col.dataType);
      if (col.isPrimaryKey) {
        if (col.dataType.toUpperCase() === 'UUID') {
          typeDef = 'String   @id @default(uuid())';
        } else {
          typeDef = 'Int      @id @default(autoincrement())';
        }
      } else if (col.isUnique) {
        typeDef += ' @unique';
      }

      if (col.name === 'created_at') {
        typeDef = 'DateTime @default(now())';
      } else if (col.name === 'updated_at') {
        typeDef = 'DateTime @updatedAt';
      }

      const opt = col.isNullable ? '?' : '';
      lines.push(`  ${col.name.padEnd(16)} ${typeDef}${opt}`);
    });

    lines.push(`  @@map("${table.name}")`);
    lines.push(`}\n`);
  });

  return lines.join('\n');
}
