import test from 'node:test';
import assert from 'node:assert/strict';
import { toPayload, toProjectData } from '../adapters/projectAdapter.ts';
import { methodBadge, priorityBadge } from '../components/step2/featureConfig.ts';
import { generateOpenApiJson, generateOpenApiYaml, generateMarkdownTable } from './apiDocs.ts';
import type { DocumentView } from '../types/index.ts';

const document = (): DocumentView => ({
  project: { id: 'p', title: '최소 문서', summary: '', categoryTag: '', targetDbms: 'mariadb',
    archivedAt: null, createdAt: '', updatedAt: '', role: 'OWNER' },
  version: 2, updatedAt: '',
  payload: { schemaVersion: 2, ideas: [], features: [{ id: 'f', name: '최소 기능' }],
    nodes: [{ id: 'n', name: '최소 노드', category: 'Service', x: 12, y: 34 }],
    connections: [], tables: [] },
});

test('minimal server DTO gets display defaults without inventing enum values or mutating input', () => {
  const view = document();
  const before = structuredClone(view);
  const project = toProjectData(view, 2);
  assert.deepEqual(view, before);
  assert.equal(project.features[0].summary, '');
  assert.deepEqual(project.features[0].responseStatusCodes, []);
  assert.deepEqual(project.nodes[0].techStack, []);
  assert.equal(project.nodes[0].description, '');
  const payload = toPayload(project);
  assert.equal('method' in payload.features[0], false);
  assert.equal('priority' in payload.features[0], false);
  assert.equal('assignedTeam' in payload.nodes[0], false);
  assert.deepEqual(methodBadge(undefined), priorityBadge(undefined));
  assert.ok(methodBadge(undefined).bg);
  assert.deepEqual(JSON.parse(generateOpenApiJson(project.features)).paths, {});
  assert.doesNotMatch(generateOpenApiYaml(project.features), /undefined|get:|post:/);
  assert.match(generateMarkdownTable(project.features), /미지정/);
});

test('normalization and later save preserve supplied fields, IDs, references and opaque item data', () => {
  const view = document();
  const opaque = { futurePreservedField: { owner: 'original', nested: [1, 2] } };
  view.payload.features[0] = { ...view.payload.features[0], ...opaque, method: 'PATCH', priority: 'P2',
    domain: 'API', summary: 'original', relatedStoryId: 'idea', responseStatusCodes: ['202 Accepted'] };
  view.payload.nodes[0] = { ...view.payload.nodes[0], ...opaque, techStack: ['Flask'],
    description: 'original', assignedTeam: 'Infra' };
  view.payload.connections = [{ id: 'edge', sourceId: 'n', targetId: 'other', protocol: 'REST' }];
  const payload = toPayload(toProjectData(view, 3));
  for (const area of ['features', 'nodes'] as const) {
    for (const [key, value] of Object.entries(view.payload[area][0])) {
      assert.deepEqual((payload[area][0] as unknown as Record<string, unknown>)[key], value);
    }
  }
  assert.deepEqual(payload.connections, view.payload.connections);
});

test('minimal API ERD gets display defaults without mutating payload or overwriting false and zero values', () => {
  const view = { project: { id: 'p', title: '최소 문서', summary: '', categoryTag: '', targetDbms: 'mariadb' },
    version: 1, updatedAt: '2026-10-22T00:00:00Z', payload: { schemaVersion: 2, ideas: [], features: [], nodes: [], connections: [],
      tables: [{ id: 't', name: 'sample', x: 0, y: 0,
        columns: [{ id: 'c', name: 'id', dataType: 'INT', isPrimaryKey: true, isNullable: false }] }] } } as unknown as DocumentView;
  const before = structuredClone(view);
  const table = toProjectData(view, 4).tables[0];
  assert.deepEqual(table.relatedFeatureIds, []);
  assert.equal(table.comment, '');
  assert.equal(table.x, 0);
  assert.equal(table.y, 0);
  assert.equal(table.columns[0].isNullable, false);
  assert.equal(table.columns[0].isPrimaryKey, true);
  assert.equal(table.columns[0].isForeignKey, false);
  assert.equal(table.columns[0].isUnique, false);
  assert.equal(table.columns[0].comment, '');
  assert.deepEqual(view, before);
});
