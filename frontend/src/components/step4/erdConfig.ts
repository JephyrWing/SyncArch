import type { SqlDialect } from '../../types/index.ts';

export const DBMS_NAMES: Record<SqlDialect, { label: string; badge: string; color: string }> = {
  postgres: { label: 'PostgreSQL 16', badge: 'Postgres', color: 'border-sky-500 text-sky-300' },
  mysql: { label: 'MySQL 8.0', badge: 'MySQL', color: 'border-amber-500 text-amber-300' },
  mariadb: { label: 'MariaDB 11', badge: 'MariaDB', color: 'border-orange-500 text-orange-300' },
  oracle: { label: 'Oracle 19c/21c', badge: 'Oracle', color: 'border-rose-500 text-rose-300' },
  mssql: { label: 'MS SQL Server', badge: 'T-SQL', color: 'border-blue-500 text-blue-300' },
  sqlite: { label: 'SQLite 3', badge: 'SQLite', color: 'border-purple-500 text-purple-300' },
  prisma: { label: 'Prisma Schema', badge: 'Prisma', color: 'border-emerald-500 text-emerald-300' },
};
