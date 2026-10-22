import type { FeatureProgressStatus, FeatureSpec } from '../types/index.ts';

// [기능 명세] 진행상황 표시 이름. 화면 배지(step2/featureConfig.ts)도 이 값을 쓴다.
export const FEATURE_STATUS_LABELS: Record<FeatureProgressStatus, string> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행중',
  QA: 'QA 검증',
  COMPLETED: '완료됨',
};

// [기능 명세] OpenAPI / Swagger 3.0 명세 JSON 생성
export const generateOpenApiJson = (features: FeatureSpec[]) => {
  const paths: Record<string, any> = {};

  features.forEach((f) => {
    if (!f.method || !f.endpoint) return;
    const methodKey = f.method.toLowerCase();
    if (!paths[f.endpoint]) {
      paths[f.endpoint] = {};
    }
    paths[f.endpoint][methodKey] = {
      summary: f.name,
      description: f.summary,
      tags: [f.domain],
      parameters: [],
      requestBody: f.method !== 'GET' ? {
        description: 'Request Payload',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              example: f.requestFields,
            },
          },
        },
      } : undefined,
      responses: f.responseStatusCodes?.length ? Object.fromEntries(f.responseStatusCodes.map(code=>[code.slice(0,3), {
        description: code.slice(4) || code.slice(0,3), content: {'application/json': {schema: {type:'object',example:f.responseFields}}},
      }])) : {
        '200': {
          description: '성공 응답',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                example: f.responseFields,
              },
            },
          },
        },
        '400': { description: '잘못된 요청 파라미터' },
        '401': { description: '인증 토큰 누락 또는 유효하지 않음' },
        '500': { description: '서버 내부 오류' },
      },
    };
  });

  return JSON.stringify({
    openapi: '3.0.3',
    info: {
      title: 'SyncArch Auto-generated API Documentation',
      version: '1.0.0',
      description: 'SyncArch에서 자동 추출된 REST API 명세서 (Swagger 3.0 호환)',
    },
    paths,
  }, null, 2);
};

// [기능 명세] OpenAPI YAML 생성
export const generateOpenApiYaml = (features: FeatureSpec[]) => {
  // JSON과 같은 단일 경로/메서드 구조를 사용한다. 문자열과 비식별자 키는 JSON 인용으로 YAML에서도 안전하다.
  const render = (node: Record<string, unknown>, indent = 0): string[] => Object.entries(node).flatMap(([key,value]) => {
    const name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key);
    const prefix = ' '.repeat(indent) + name + ':';
    return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length
      ? [prefix, ...render(value as Record<string,unknown>,indent+2)] : [prefix+' '+JSON.stringify(value)];
  });
  return render(JSON.parse(generateOpenApiJson(features))).join('\n');
};

// [기능 명세] Markdown API 표 생성
export const generateMarkdownTable = (features: FeatureSpec[]) => {
  const lines: string[] = [
    '# API 명세서 (자동 추출)',
    '',
    `| 도메인 | 메서드 | 엔드포인트 | 기능명 | 우선순위 | 진행상황 | 담당자 |`,
    `|:---|:---:|:---|:---|:---:|:---:|:---:|`,
  ];

  features.forEach((f) => {
    lines.push(`| ${f.domain} | **${f.method ?? '미지정'}** | \`${f.endpoint}\` | ${f.name} | ${f.priority ?? '미지정'} | ${FEATURE_STATUS_LABELS[f.status]} | ${f.assignee} |`);
  });

  lines.push('', '## 엔드포인트별 상세 입출력 명세', '');
  features.forEach((f) => {
    lines.push(`### [${f.method ?? '미지정'}] ${f.endpoint} - ${f.name}`);
    lines.push(`- **설명**: ${f.summary}`);
    lines.push(`- **요청 파라미터**: \`${f.requestFields}\``);
    lines.push(`- **응답 필드**: \`${f.responseFields}\``);
    lines.push('');
  });

  return lines.join('\n');
};
