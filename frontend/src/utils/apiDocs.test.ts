import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownTable, generateOpenApiJson, generateOpenApiYaml } from './apiDocs.ts';
import type { FeatureSpec } from '../types/index.ts';

const features: FeatureSpec[] = [
  {
    id: 'FEAT-01',
    domain: '출석',
    name: 'QR 출석',
    priority: 'P0',
    assignee: '현우',
    method: 'POST',
    endpoint: '/api/v1/attendance',
    requestFields: 'code: string',
    responseFields: 'ok: boolean',
    summary: 'QR로 출석한다',
    status: 'QA',
    responseStatusCodes: ['200 OK'],
  },
  {
    id: 'FEAT-02',
    domain: '출석',
    name: '출석 조회',
    priority: 'P1',
    assignee: '수민',
    method: 'GET',
    endpoint: '/api/v1/attendance',
    requestFields: 'None',
    responseFields: 'items: []',
    summary: '출석을 조회한다',
    status: 'PLANNED',
    responseStatusCodes: ['200 OK'],
  },
];

test('OpenAPI JSON groups methods under one path and skips requestBody for GET', () => {
  const doc = JSON.parse(generateOpenApiJson(features));
  const path = doc.paths['/api/v1/attendance'];
  assert.deepEqual(Object.keys(path).sort(), ['get', 'post']);
  assert.equal(path.post.requestBody.content['application/json'].schema.example, 'code: string');
  assert.equal(path.get.requestBody, undefined);
});

test('OpenAPI YAML adds requestBody only for non-GET methods', () => {
  const yaml = generateOpenApiYaml(features);
  assert.equal(yaml.split('\n').filter((line) => line === '      requestBody:').length, 1);
});

test('Markdown table shows Korean status labels', () => {
  const md = generateMarkdownTable(features);
  assert.match(md, /\| 출석 \| \*\*POST\*\* \| `\/api\/v1\/attendance` \| QR 출석 \| P0 \| QA 검증 \| 현우 \|/);
  assert.match(md, /\| 계획 \| 수민 \|/);
});
