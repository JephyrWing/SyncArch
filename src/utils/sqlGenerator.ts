import type { ErdTable, ExportSettings, SqlDialect } from '../types/index.ts';

/**
 * Topologically sorts tables based on foreign key references.
 * Parent tables (which are referenced) appear BEFORE child tables (which reference them).
 */
export function sortTablesTopologically(tables: ErdTable[]): ErdTable[] {
  const tableMap = new Map<string, ErdTable>();
  tables.forEach(t => tableMap.set(t.name.toLowerCase(), t));

  // Build dependency graph: table -> array of parent table names it references
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
      // Cycle detected, break cycle gracefully
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

  // In case any table wasn't included (e.g. orphan)
  tables.forEach(t => {
    if (!sorted.some(s => s.id === t.id)) {
      sorted.push(t);
    }
  });

  return sorted;
}

/**
 * Maps standard data types to dialect specific types
 */
function mapDataType(type: string, dialect: SqlDialect): string {
  const upper = type.toUpperCase().trim();
  
  if (dialect === 'postgres') {
    return upper;
  }
  
  if (dialect === 'mysql' || dialect === 'mariadb') {
    if (upper === 'UUID') return dialect === 'mariadb' ? 'UUID' : 'VARCHAR(36)';
    if (upper === 'TIMESTAMPTZ') return 'DATETIME(6)';
    if (upper === 'BOOLEAN') return 'TINYINT(1)';
    if (upper === 'TEXT') return 'LONGTEXT';
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
 * Generates SQL DDL or Prisma Schema based on options and selected DBMS
 */
export function generateSql(tables: ErdTable[], settings: ExportSettings): string {
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
  lines.push(`-- Generated At: ${new Date().toISOString()}`);
  lines.push(`-- ==============================================================\n`);

  if (settings.dialect === 'mysql' || settings.dialect === 'mariadb') {
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  } else if (settings.dialect === 'sqlite') {
    lines.push(`PRAGMA foreign_keys = ON;\n`);
  }

  // 1. Drop existing tables
  if (settings.includeDropTable) {
    lines.push(`-- 1. DROP EXISTING TABLES (Reverse Dependency Order)`);
    const reverseTables = [...sortedTables].reverse();
    reverseTables.forEach(t => {
      if (settings.dialect === 'postgres') {
        lines.push(`DROP TABLE IF EXISTS ${t.name} CASCADE;`);
      } else if (settings.dialect === 'mysql' || settings.dialect === 'mariadb' || settings.dialect === 'sqlite') {
        lines.push(`DROP TABLE IF EXISTS ${t.name};`);
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

  // 2. Create tables
  lines.push(`-- 2. CREATE TABLES`);
  sortedTables.forEach(table => {
    const tableName = settings.dialect === 'oracle' ? table.name.toUpperCase() : table.name;
    lines.push(`-- Table: ${tableName} (${table.comment || '설명 없음'})`);
    
    if (settings.dialect === 'mssql') {
      lines.push(`CREATE TABLE dbo.${tableName} (`);
    } else {
      lines.push(`CREATE TABLE ${tableName} (`);
    }

    const colDefinitions: string[] = [];
    const pkCols: string[] = [];
    const fkConstraints: string[] = [];

    table.columns.forEach(col => {
      const colName = settings.dialect === 'oracle' ? col.name.toUpperCase() : col.name;
      let mappedType = mapDataType(col.dataType, settings.dialect);
      let def = `    ${colName.padEnd(16)} ${mappedType}`;

      if (col.isPrimaryKey) {
        pkCols.push(colName);
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

      // MySQL/MariaDB inline comment support
      if ((settings.dialect === 'mysql' || settings.dialect === 'mariadb') && settings.includeComments && col.comment) {
        def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
      }

      colDefinitions.push(def);

      // Foreign key
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
              `    CONSTRAINT ${fkName} FOREIGN KEY (${colName}) REFERENCES ${refTable}(${refCol}) ON DELETE CASCADE`
            );
          }
        }
      }
    });

    // Primary key constraint
    if (pkCols.length > 0) {
      colDefinitions.push(`    CONSTRAINT pk_${tableName} PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // Append foreign keys
    colDefinitions.push(...fkConstraints);

    lines.push(colDefinitions.join(',\n'));
    
    if (settings.dialect === 'mysql' || settings.dialect === 'mariadb') {
      if (settings.includeComments && table.comment) {
        lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${table.comment.replace(/'/g, "\\'")}';\n`);
      } else {
        lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`);
      }
    } else {
      lines.push(`);\n`);
    }

    // PostgreSQL & Oracle Comments
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

  // 3. Indexes
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
            lines.push(`CREATE INDEX idx_${tableName}_${colName} ON ${tableName} (${colName});`);
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
 * Generates Prisma Schema DSL
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
