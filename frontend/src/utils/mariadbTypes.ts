import type { ErdColumn } from '../types/index.ts';

export interface DataTypeOption {
  name: string;
  value: string;
  group: string;
  description: string;
}

const options = (group: string, entries: [string, string, string][]): DataTypeOption[] =>
  entries.map(([name, value, description]) => ({ name, value, group, description }));

/** [ERD 설계] MariaDB 11.4 자료형의 별칭은 검색에 포함하고 선택지는 중복하지 않는다. */
export const MARIADB_TYPES: DataTypeOption[] = [
  ...options('숫자', [
    ['TINYINT', 'TINYINT', '아주 작은 정수'], ['SMALLINT', 'SMALLINT', '작은 정수'],
    ['MEDIUMINT', 'MEDIUMINT', '중간 정수'], ['INT', 'INT', '정수 · INTEGER'],
    ['BIGINT', 'BIGINT', '큰 정수'], ['DECIMAL', 'DECIMAL(10,2)', '정확한 소수 · NUMERIC · DEC · FIXED'],
    ['FLOAT', 'FLOAT', '단정밀도 실수'], ['DOUBLE', 'DOUBLE', '배정밀도 실수 · REAL · DOUBLE PRECISION'],
    ['BIT', 'BIT(1)', '비트 · 길이 1~64'], ['BOOLEAN', 'BOOLEAN', '참/거짓 · BOOL'],
    ...['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'].map((name): [string, string, string] =>
      [`${name} UNSIGNED`, `${name} UNSIGNED`, '음수 없는 정수']),
    ['DECIMAL UNSIGNED', 'DECIMAL(10,2) UNSIGNED', '음수 없는 정확한 소수'],
  ]),
  ...options('문자', [
    ['CHAR', 'CHAR(36)', '고정 길이 문자열'], ['VARCHAR', 'VARCHAR(255)', '가변 길이 문자열'],
    ['TINYTEXT', 'TINYTEXT', '최대 255바이트 텍스트'], ['TEXT', 'TEXT', '최대 65,535바이트 텍스트'],
    ['MEDIUMTEXT', 'MEDIUMTEXT', '중간 크기 텍스트'], ['LONGTEXT', 'LONGTEXT', '긴 텍스트'],
    ['ENUM', "ENUM('active','inactive')", '목록에서 하나 선택 · 값의 대소문자 유지'],
    ['SET', "SET('read','write')", '목록에서 여러 값 선택'],
  ]),
  ...options('날짜/시간', [
    ['DATE', 'DATE', '날짜'], ['TIME', 'TIME(6)', '시간 · 소수초 0~6'],
    ['DATETIME', 'DATETIME(6)', '날짜와 시간 · 소수초 0~6'],
    ['TIMESTAMP', 'TIMESTAMP(6)', '타임스탬프 · 소수초 0~6'], ['YEAR', 'YEAR', '연도'],
  ]),
  ...options('바이너리', [
    ['BINARY', 'BINARY(16)', '고정 길이 바이트'], ['VARBINARY', 'VARBINARY(255)', '가변 길이 바이트'],
    ['TINYBLOB', 'TINYBLOB', '작은 바이너리'], ['BLOB', 'BLOB', '바이너리'],
    ['MEDIUMBLOB', 'MEDIUMBLOB', '중간 바이너리'], ['LONGBLOB', 'LONGBLOB', '큰 바이너리'],
  ]),
  ...options('기타', [
    ['JSON', 'JSON', 'JSON 문서'], ['UUID', 'UUID', '식별자 · 내보내기는 CHAR(36)'],
    ['INET4', 'INET4', 'IPv4 주소'], ['INET6', 'INET6', 'IPv6 주소'],
    ...['GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION']
      .map((name): [string, string, string] => [name, name, '공간 데이터']),
  ]),
];

export const searchMariaDbTypes = (query: string): DataTypeOption[] => {
  const needle = query.trim().toLowerCase();
  return MARIADB_TYPES.filter((option) =>
    `${option.name} ${option.group} ${option.description}`.toLowerCase().includes(needle));
};

/** [ERD 설계] 서버가 분리한 자료형 매개변수를 화면·DDL 표기로 복원한다. */
export const columnTypeExpression = (column: Pick<ErdColumn, 'dataType' | 'length' | 'precision' | 'scale'>): string => {
  const type = column.dataType;
  if (type.includes('(')) return type;
  const base = type.replace(/ UNSIGNED$/i, '').toUpperCase();
  const suffix = / UNSIGNED$/i.test(type) ? ' UNSIGNED' : '';
  if (column.length !== undefined) return `${base}(${column.length})${suffix}`;
  if (column.precision !== undefined) {
    const scale = column.scale !== undefined ? `,${column.scale}` : '';
    return `${base}(${column.precision}${scale})${suffix}`;
  }
  return type;
};

/** [ERD 설계] ENUM·SET의 사용자 값은 보존하고 키워드만 대문자로 바꾼다. */
export const normalizeTypeExpression = (value: string): string => {
  const trimmed = value.trim();
  const choice = /^(enum|set)\s*(\(.*\))$/is.exec(trimmed);
  return choice ? `${choice[1].toUpperCase()}${choice[2]}` : trimmed.toUpperCase().replace(/^DOUBLE\s+PRECISION(?= UNSIGNED$|$)/, 'DOUBLE');
};

export interface TypeParameter {
  key: 'length' | 'precision' | 'scale';
  label: string;
  value: number;
  min: number;
  max: number;
}

/** [ERD 설계] 서버 정규화 필드가 반영된 표기에서 편집할 매개변수를 찾는다. */
export const mariaDbTypeParameters = (expression: string): TypeParameter[] => {
  const match = /^(\w+)(?:\((\d+)(?:\s*,\s*(\d+))?\))?( UNSIGNED)?$/.exec(normalizeTypeExpression(expression));
  if (!match) return [];
  const base = match[1];
  const first = match[2] === undefined ? undefined : Number(match[2]);
  const lengths: Record<string, number> = { CHAR: 255, VARCHAR: 16383, BINARY: 255, VARBINARY: 65532, BIT: 64 };
  if (base in lengths) return [{ key: 'length', label: base === 'BIT' ? '비트 수' : base === 'BINARY' || base === 'VARBINARY' ? '길이(바이트)' : '길이',
    value: first ?? 1, min: 1, max: lengths[base] }];
  if (['DECIMAL', 'DEC', 'NUMERIC', 'FIXED'].includes(base)) return [
    { key: 'precision', label: '전체 자릿수', value: first ?? 10, min: 1, max: 65 },
    { key: 'scale', label: '소수 자릿수', value: Number(match[3] ?? 0), min: 0, max: 38 },
  ];
  if (['DATETIME', 'TIME', 'TIMESTAMP'].includes(base)) return [
    { key: 'precision', label: '소수초 자릿수', value: first ?? 0, min: 0, max: 6 },
  ];
  return [];
};

export const withMariaDbTypeParameters = (expression: string, values: string[]): string => {
  const match = /^(\w+)(?:\([^)]*\))?( UNSIGNED)?$/.exec(normalizeTypeExpression(expression));
  if (!match || !mariaDbTypeParameters(expression).length) return expression;
  return `${match[1]}(${values.join(',')})${match[2] ?? ''}`;
};

/** [ERD 설계] 완성하지 않은 자료형 검색어가 자동 저장에 들어가지 않게 한다. */
export const mariaDbTypeError = (expression: string): string => {
  const value = normalizeTypeExpression(expression);
  const choice = /^(ENUM|SET)\((.*)\)$/s.exec(value);
  if (choice) {
    const literal = "'(?:[^'\\\\\\x00-\\x1f]|'')*'";
    if (!new RegExp(`^\\s*${literal}(?:\\s*,\\s*${literal})*\\s*$`).test(choice[2])) return "값을 작은따옴표로 묶으세요. 예: ENUM('active','inactive')";
    const labels = [...choice[2].matchAll(new RegExp(literal, 'g'))].map((match) => match[0].slice(1, -1).replaceAll("''", "'"));
    if (new Set(labels).size !== labels.length || (choice[1] === 'SET' && (labels.length > 64 || labels.some((label) => label.includes(','))))) return '중복 값 또는 SET의 쉼표·64개 제한을 확인하세요.';
    return value.length > 4000 ? '자료형 표기는 4,000자 이하로 입력하세요.' : '';
  }
  const match = /^(\w+)(?:\((\d+)(?:\s*,\s*(\d+))?\))?( UNSIGNED)?$/.exec(value);
  if (!match) return '목록에서 선택하거나 길이·정밀도를 완성하세요. 예: VARCHAR(255)';
  const base = ({ INTEGER: 'INT', BOOL: 'BOOLEAN', NUMERIC: 'DECIMAL', DEC: 'DECIMAL', FIXED: 'DECIMAL', REAL: 'DOUBLE' } as Record<string, string>)[match[1]] ?? match[1];
  if (!MARIADB_TYPES.some((option) => option.name === base)) return '지원하는 MariaDB 타입을 목록에서 선택하세요.';
  if (match[4] && !['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(base)) return 'UNSIGNED는 숫자 타입에만 지정하세요.';
  const first = match[2] === undefined ? undefined : Number(match[2]);
  const second = match[3] === undefined ? undefined : Number(match[3]);
  const lengths: Record<string, [number, number]> = { CHAR: [1, 255], VARCHAR: [1, 16383], BINARY: [1, 255], VARBINARY: [1, 65532], BIT: [1, 64] };
  if (base in lengths) {
    const [min, max] = lengths[base];
    if (first === undefined && ['VARCHAR', 'VARBINARY'].includes(base)) return '괄호 안에 길이를 입력하세요.';
    if (second !== undefined || (first !== undefined && (first < min || first > max))) return `길이는 ${min}~${max} 사이로 입력하세요.`;
  } else if (base === 'DECIMAL') {
    if (first === undefined || first < 1 || first > 65 || (second ?? 0) > Math.min(first, 38)) return 'DECIMAL(전체 자릿수 1~65, 소수 자릿수 0~38)을 입력하세요.';
  } else if (['TIME', 'DATETIME', 'TIMESTAMP'].includes(base)) {
    if (second !== undefined || (first !== undefined && first > 6)) return '소수초 정밀도는 0~6 사이로 입력하세요.';
  } else if (first !== undefined) return '이 타입에는 길이·정밀도를 지정하지 않습니다.';
  return '';
};
