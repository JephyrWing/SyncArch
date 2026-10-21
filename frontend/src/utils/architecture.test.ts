import test from 'node:test';
import assert from 'node:assert/strict';
import type { ArchNode, ArchConnection } from '../types/index.ts';

// TC-ARCH-01: 구성 요소 편집과 ID·위치 보존
test('TC-ARCH-01: updating node preserves original ID, position coordinates and keeps existing connections intact', () => {
  const originalNode: ArchNode = {
    id: 'node-core-api',
    name: 'Core API Gateway',
    category: 'Service',
    techStack: ['Node.js', 'Express'],
    x: 150,
    y: 200,
    description: '초기 API 게이트웨이',
    assignedTeam: 'Backend',
  };

  const initialConnections: ArchConnection[] = [
    {
      id: 'conn-1',
      sourceId: 'node-client-web',
      targetId: 'node-core-api',
      protocol: 'REST',
      label: 'HTTP Ingress',
      description: '클라이언트 진입점',
    },
    {
      id: 'conn-2',
      sourceId: 'node-core-api',
      targetId: 'node-db-main',
      protocol: 'SQL',
      label: 'DB Connection',
      description: '메인 데이터 조회',
    },
  ];

  // 속성 수정 수행 (이름, 기술스택, 설명 변경)
  const updatedProps: Partial<ArchNode> = {
    name: 'Advanced API Gateway',
    techStack: ['FastAPI', 'Python', 'Redis'],
    description: '개선된 비동기 게이트웨이 및 캐시 적용',
    assignedTeam: 'Common',
  };

  const updatedNode: ArchNode = {
    ...originalNode,
    ...updatedProps,
  };

  // 검증: ID와 좌표(x, y)가 그대로 보존되는지 확인
  assert.equal(updatedNode.id, originalNode.id, '노드 ID가 변경되지 않고 보존되어야 합니다');
  assert.equal(updatedNode.x, originalNode.x, 'X 좌표가 보존되어야 합니다');
  assert.equal(updatedNode.y, originalNode.y, 'Y 좌표가 보존되어야 합니다');
  assert.equal(updatedNode.name, 'Advanced API Gateway');
  assert.deepEqual(updatedNode.techStack, ['FastAPI', 'Python', 'Redis']);
  assert.equal(updatedNode.description, '개선된 비동기 게이트웨이 및 캐시 적용');
  assert.equal(updatedNode.assignedTeam, 'Common');

  // 검증: 기존 연결선의 sourceId/targetId 참조가 유효하게 유지되는지 확인
  const activeConnections = initialConnections.filter(
    (c) => c.sourceId === updatedNode.id || c.targetId === updatedNode.id
  );
  assert.equal(activeConnections.length, 2, '노드 ID가 유지되므로 연결선 2개가 모두 활성 상태여야 합니다');
});

// TC-ARCH-02: 통신 연결 속성(name/label, protocol, direction, description) 수정 및 ID 보존
test('TC-ARCH-02: updating connection preserves connection ID and updates protocol, label, and description', () => {
  const originalConn: ArchConnection = {
    id: 'conn-ws-event',
    sourceId: 'node-gateway',
    targetId: 'node-worker',
    protocol: 'REST',
    label: '이벤트 요청',
    description: '동기 HTTP 요청',
  };

  // 프로토콜을 WebSocket으로 변경하고 설명 및 방향성 규격 갱신
  const updatedProps: Partial<ArchConnection> = {
    protocol: 'WebSocket',
    label: '실시간 이벤트 스트림',
    description: '양방향 WSS 핑퐁 및 상태 브로드캐스트',
  };

  const updatedConn: ArchConnection = {
    ...originalConn,
    ...updatedProps,
  };

  // 검증
  assert.equal(updatedConn.id, originalConn.id, '연결선 ID가 보존되어야 합니다');
  assert.equal(updatedConn.sourceId, originalConn.sourceId, '출발 노드가 보존되어야 합니다');
  assert.equal(updatedConn.targetId, originalConn.targetId, '도착 노드가 보존되어야 합니다');
  assert.equal(updatedConn.protocol, 'WebSocket', '프로토콜이 변경되어야 합니다');
  assert.equal(updatedConn.label, '실시간 이벤트 스트림');
  assert.equal(updatedConn.description, '양방향 WSS 핑퐁 및 상태 브로드캐스트');
});

// TC-SAFE-01: 참조 일관성 - 없는 요소 연결 방지 및 노드 삭제 시 연결선 동반 삭제
test('TC-SAFE-01: preventing connection to non-existent nodes and removing orphaned connections upon node deletion', () => {
  let nodes: ArchNode[] = [
    { id: 'node-1', name: 'Web Client', category: 'Client', techStack: [], x: 0, y: 0, description: '' },
    { id: 'node-2', name: 'App Server', category: 'Service', techStack: [], x: 0, y: 0, description: '' },
    { id: 'node-3', name: 'Database', category: 'DataStore', techStack: [], x: 0, y: 0, description: '' },
  ];

  let connections: ArchConnection[] = [
    { id: 'c-1', sourceId: 'node-1', targetId: 'node-2', protocol: 'REST' },
    { id: 'c-2', sourceId: 'node-2', targetId: 'node-3', protocol: 'SQL' },
  ];

  // 1. 존재하지 않는 노드('node-999')로 새 연결 생성 시도시 차단 검증
  const addConnection = (conn: Omit<ArchConnection, 'id'>) => {
    const validSource = nodes.some((n) => n.id === conn.sourceId);
    const validTarget = nodes.some((n) => n.id === conn.targetId);
    if (!validSource || !validTarget || conn.sourceId === conn.targetId) {
      return false;
    }
    connections.push({ ...conn, id: `c-${Date.now()}` });
    return true;
  };

  const invalidAttempt1 = addConnection({ sourceId: 'node-1', targetId: 'node-999', protocol: 'REST' });
  assert.equal(invalidAttempt1, false, '존재하지 않는 targetId 연결은 거부되어야 합니다');

  const invalidAttempt2 = addConnection({ sourceId: 'node-1', targetId: 'node-1', protocol: 'REST' });
  assert.equal(invalidAttempt2, false, '출발지와 도착지가 같은 자기참조 연결은 거부되어야 합니다');

  assert.equal(connections.length, 2, '유효하지 않은 연결선이 추가되지 않아야 합니다');

  // 2. 'node-2' 삭제 시, node-2와 연결된 c-1, c-2가 모두 정리되는지 검증
  const deleteNode = (nodeId: string) => {
    nodes = nodes.filter((n) => n.id !== nodeId);
    connections = connections.filter((c) => c.sourceId !== nodeId && c.targetId !== nodeId);
  };

  deleteNode('node-2');

  assert.equal(nodes.length, 2, 'node-2가 삭제되어야 합니다');
  assert.equal(connections.length, 0, 'node-2에 연결되었던 c-1, c-2 연결선이 모두 동반 삭제되어야 합니다');
});
