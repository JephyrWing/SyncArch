import type { ErdTable, ExportSettings } from '../types/index.ts';

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
function mapDataType(type: string, dialect: ExportSettings['dialect']): string {
  const upper = type.toUpperCase().trim();
  if (dialect === 'postgres') {
    return upper;
  } else if (dialect === 'mysql') {
    if (upper === 'UUID') return 'VARCHAR(36)';
    if (upper === 'TIMESTAMPTZ') return 'DATETIME(6)';
    if (upper === 'BOOLEAN') return 'TINYINT(1)';
    if (upper === 'TEXT') return 'LONGTEXT';
    return upper;
  } else if (dialect === 'sqlite') {
    if (upper.includes('INT')) return 'INTEGER';
    if (upper === 'UUID' || upper.includes('VARCHAR') || upper === 'TEXT') return 'TEXT';
    if (upper === 'BOOLEAN') return 'INTEGER';
    if (upper.includes('TIME') || upper.includes('DATE')) return 'TEXT';
    return upper;
  }
  return upper;
}

/**
 * Generates SQL DDL or Prisma Schema based on options
 */
export function generateSql(tables: ErdTable[], settings: ExportSettings): string {
  if (tables.length === 0) return '-- 정의된 테이블이 없습니다.';

  if (settings.dialect === 'prisma') {
    return generatePrismaSchema(tables);
  }

  const sortedTables = sortTablesTopologically(tables);
  const lines: string[] = [];

  lines.push(`-- ==============================================================`);
  lines.push(`-- SyncArch Auto-generated DDL Script`);
  lines.push(`-- Dialect: ${settings.dialect.toUpperCase()}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- ==============================================================\n`);

  // Drop tables in reverse topological order (children first)
  if (settings.includeDropTable) {
    lines.push(`-- 1. DROP EXISTING TABLES (Reverse Dependency Order)`);
    const reverseTables = [...sortedTables].reverse();
    reverseTables.forEach(t => {
      lines.push(`DROP TABLE IF EXISTS ${t.name} CASCADE;`);
    });
    lines.push('');
  }

  // Create tables
  lines.push(`-- 2. CREATE TABLES`);
  sortedTables.forEach(table => {
    lines.push(`-- Table: ${table.name} (${table.comment || '설명 없음'})`);
    lines.push(`CREATE TABLE ${table.name} (`);

    const colDefinitions: string[] = [];
    const pkCols: string[] = [];
    const fkConstraints: string[] = [];

    table.columns.forEach(col => {
      let def = `    ${col.name.padEnd(16)} ${mapDataType(col.dataType, settings.dialect)}`;

      if (col.isPrimaryKey) {
        pkCols.push(col.name);
      }
      if (!col.isNullable) {
        def += ' NOT NULL';
      }
      if (col.isUnique && !col.isPrimaryKey) {
        def += ' UNIQUE';
      }
      if (col.defaultValue && col.defaultValue.trim() !== '') {
        def += ` DEFAULT ${col.defaultValue}`;
      }

      // MySQL inline comment support
      if (settings.dialect === 'mysql' && settings.includeComments && col.comment) {
        def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
      }

      colDefinitions.push(def);

      // Foreign key
      if (settings.includeForeignKeys && col.isForeignKey && col.references) {
        const [refTable, refCol] = col.references.split('.');
        if (refTable && refCol) {
          fkConstraints.push(
            `    CONSTRAINT fk_${table.name}_${col.name} FOREIGN KEY (${col.name}) REFERENCES ${refTable}(${refCol}) ON DELETE CASCADE`
          );
        }
      }
    });

    // Primary key constraint
    if (pkCols.length > 0) {
      colDefinitions.push(`    CONSTRAINT pk_${table.name} PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // Append foreign keys
    colDefinitions.push(...fkConstraints);

    lines.push(colDefinitions.join(',\n'));
    
    if (settings.dialect === 'mysql' && settings.includeComments && table.comment) {
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${table.comment.replace(/'/g, "\\'")}';\n`);
    } else {
      lines.push(`);\n`);
    }

    // PostgreSQL Comments
    if (settings.dialect === 'postgres' && settings.includeComments) {
      if (table.comment) {
        lines.push(`COMMENT ON TABLE ${table.name} IS '${table.comment.replace(/'/g, "''")}';`);
      }
      table.columns.forEach(c => {
        if (c.comment) {
          lines.push(`COMMENT ON COLUMN ${table.name}.${c.name} IS '${c.comment.replace(/'/g, "''")}';`);
        }
      });
      lines.push('');
    }
  });

  // Indexes
  if (settings.includeIndexes) {
    lines.push(`-- 3. CREATE PERFORMANCE & FOREIGN KEY INDEXES`);
    sortedTables.forEach(table => {
      table.columns.forEach(col => {
        if (col.isForeignKey && !col.isPrimaryKey) {
          lines.push(`CREATE INDEX idx_${table.name}_${col.name} ON ${table.name} (${col.name});`);
        }
      });
    });
    lines.push('');
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
