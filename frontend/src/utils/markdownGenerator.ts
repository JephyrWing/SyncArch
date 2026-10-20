import type { IdeaCard, FeatureSpec, ArchNode, ArchConnection, ErdTable } from '../types/index.ts';

export function generateMarkdownSpec(
  title: string,
  summary: string,
  cards: IdeaCard[],
  features: FeatureSpec[],
  nodes: ArchNode[],
  connections: ArchConnection[],
  tables: ErdTable[]
): string {
  const lines: string[] = [];

  lines.push(`# 🏛️ ${title || 'SyncArch 프로젝트 아키텍처 명세서'}`);
  lines.push(`> **문서 생성일:** ${new Date().toLocaleDateString('ko-KR')} | **설계 도구:** SyncArch Studio (5인 애자일 팀 협업 스위트)\n`);

  lines.push(`## 0. 프로젝트 개요`);
  lines.push(`- **한 줄 요약:** ${summary || '사내 스터디 매칭 & 출석 관리 플랫폼'}`);
  lines.push(`- **설계 완료 단계:** Step 1 (아이디어) → Step 2 (기능/API) → Step 3 (시스템 아키텍처) → Step 4 (DB ERD)\n`);

  // Step 1
  lines.push(`---`);
  lines.push(`## 1. 아이디어 및 요구사항 분석 (Step 1)`);
  lines.push(`| 분류 | 제목 | 상세 내용 | 제안자 | 팀 투표 수 |`);
  lines.push(`| :--- | :--- | :--- | :---: | :---: |`);

  const categoryLabels: Record<string, string> = {
    problems_goals: '🎯 핵심 문제 & 목표',
    actors: '👤 주요 사용자 역할',
    user_stories: '📖 핵심 유저 스토리',
    constraints: '⚙️ 기술적 제약 & 비기능',
  };

  cards.forEach(card => {
    const cat = categoryLabels[card.category] || card.category;
    lines.push(`| ${cat} | **${card.title}** | ${card.description} | ${card.author} | ⭐ ${card.votes}표 |`);
  });
  lines.push('');

  // Step 2
  lines.push(`---`);
  lines.push(`## 2. 기능 명세 및 API 설계 (Step 2)`);
  lines.push(`| 기능 ID | 도메인 | 기능명 | 우선순위 | 담당자 | HTTP Method | Endpoint | 핵심 필드 |`);
  lines.push(`| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :--- |`);

  features.forEach(f => {
    lines.push(`| **${f.id}** | ${f.domain} | ${f.name} | \`${f.priority}\` | ${f.assignee} | \`${f.method}\` | \`${f.endpoint}\` | ${f.requestFields} → ${f.responseFields} |`);
  });
  lines.push('');

  lines.push(`### 2.1 API 호출 & 유저 플로우 다이어그램 (Mermaid)`);
  lines.push('```mermaid');
  lines.push('flowchart TD');
  lines.push('    Start([사용자 진입]) --> Auth[FEAT-01: 사내 SSO 로그인]');
  features.forEach(f => {
    if (f.id !== 'FEAT-01') {
      lines.push(`    Auth --> ${f.id.replace('-', '')}["[${f.method}] ${f.name} (${f.endpoint})"]`);
    }
  });
  lines.push('```\n');

  // Step 3
  lines.push(`---`);
  lines.push(`## 3. 시스템 아키텍처 설계 (Step 3)`);
  lines.push(`### 3.1 아키텍처 컴포넌트 목록`);
  lines.push(`| 카테고리 | 컴포넌트 명 | 기술 스택 | 설명 |`);
  lines.push(`| :---: | :--- | :--- | :--- |`);

  nodes.forEach(n => {
    lines.push(`| **${n.category}** | **${n.name}** | \`${n.techStack.join(', ')}\` | ${n.description} |`);
  });
  lines.push('');

  lines.push(`### 3.2 시스템 아키텍처 다이어그램 (Mermaid LR)`);
  lines.push('```mermaid');
  lines.push('flowchart LR');
  
  // Group nodes by category
  const clientNodes = nodes.filter(n => n.category === 'Client');
  const serviceNodes = nodes.filter(n => n.category === 'Service');
  const dataNodes = nodes.filter(n => n.category === 'DataStore');
  const infraNodes = nodes.filter(n => n.category === 'Messaging' || n.category === 'Infra');

  if (clientNodes.length > 0) {
    lines.push('    subgraph ClientLayer [Client Tier]');
    clientNodes.forEach(c => lines.push(`        ${c.id.replace(/-/g, '_')}["${c.name}\\n(${c.techStack.join(', ')})"]`));
    lines.push('    end');
  }

  if (serviceNodes.length > 0) {
    lines.push('    subgraph ServiceLayer [Application & API Gateway]');
    serviceNodes.forEach(s => lines.push(`        ${s.id.replace(/-/g, '_')}["${s.name}\\n(${s.techStack.join(', ')})"]`));
    lines.push('    end');
  }

  if (infraNodes.length > 0) {
    lines.push('    subgraph InfraLayer [Messaging & Cache]');
    infraNodes.forEach(i => lines.push(`        ${i.id.replace(/-/g, '_')}["${i.name}\\n(${i.techStack.join(', ')})"]`));
    lines.push('    end');
  }

  if (dataNodes.length > 0) {
    lines.push('    subgraph DataLayer [Persistent Storage]');
    dataNodes.forEach(d => lines.push(`        ${d.id.replace(/-/g, '_')}[("${d.name}\\n${d.techStack.join(', ')}")]`));
    lines.push('    end');
  }

  connections.forEach(conn => {
    const s = conn.sourceId.replace(/-/g, '_');
    const t = conn.targetId.replace(/-/g, '_');
    lines.push(`    ${s} -- "${conn.protocol}${conn.label ? ` (${conn.label})` : ''}" --> ${t}`);
  });

  lines.push('```\n');

  // Step 4
  lines.push(`---`);
  lines.push(`## 4. 데이터베이스 ERD 명세 (Step 4)`);
  tables.forEach(table => {
    lines.push(`### 4.${tables.indexOf(table) + 1} 테이블: \`${table.name}\` (${table.comment})`);
    if (table.relatedFeatureIds.length > 0) {
      lines.push(`> **연관 기능:** ${table.relatedFeatureIds.join(', ')}`);
    }
    lines.push(`| 컬럼명 | 데이터 타입 | PK | FK 참조 | Null 허용 | Unique | 기본값 | 설명 |`);
    lines.push(`| :--- | :--- | :---: | :--- | :---: | :---: | :--- | :--- |`);

    table.columns.forEach(col => {
      lines.push(
        `| **${col.name}** | \`${col.dataType}\` | ${col.isPrimaryKey ? '🔑 PK' : '-'} | ${col.isForeignKey ? `🔗 \`${col.references}\`` : '-'} | ${col.isNullable ? 'YES' : 'NO'} | ${col.isUnique ? 'UNIQUE' : '-'} | ${col.defaultValue || '-'} | ${col.comment} |`
      );
    });
    lines.push('');
  });

  lines.push(`### 4.9 ERD 관계도 다이어그램 (Mermaid erDiagram)`);
  lines.push('```mermaid');
  lines.push('erDiagram');
  tables.forEach(table => {
    lines.push(`    ${table.name} {`);
    table.columns.forEach(col => {
      const typeStr = col.dataType.replace(/\(.*\)/, '').replace(/ /g, '_');
      const pkOrFk = col.isPrimaryKey ? 'PK' : col.isForeignKey ? 'FK' : '';
      lines.push(`        ${typeStr} ${col.name} ${pkOrFk} "${col.comment.replace(/"/g, "'")}"`);
    });
    lines.push(`    }`);
  });

  // Relationships
  tables.forEach(table => {
    table.columns.forEach(col => {
      if (col.isForeignKey && col.references) {
        const [refTable] = col.references.split('.');
        if (refTable) {
          lines.push(`    ${refTable} ||--o{ ${table.name} : "references"`);
        }
      }
    });
  });

  lines.push('```\n');

  lines.push(`---\n*End of Architecture Specification Document by SyncArch.*`);

  return lines.join('\n');
}
