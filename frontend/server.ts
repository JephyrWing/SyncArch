import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI if key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback smart generators when API key is missing or offline
function generateFallbackDraft(step: number, projectSummary: string, context: any) {
  if (step === 1) {
    return {
      cards: [
        {
          id: `card-ai-${Date.now()}-1`,
          category: 'problems_goals',
          title: '스터디 그룹 참여 동기 저하 및 노쇼(No-show) 방지',
          description: '보증금 예치 및 실시간 QR/위치 기반 출석 체크를 통한 동기 부여 메커니즘 제공',
          author: 'AI Co-Architect',
          votes: 2,
          votedBy: ['현우', '지훈'],
          comments: [{ id: 'c1', author: '현우', text: '보증금 환급 로직 정책 정의 필요', createdAt: '방금 전' }],
          isAiDraft: true,
        },
        {
          id: `card-ai-${Date.now()}-2`,
          category: 'user_stories',
          title: '스터디 개설 및 직무/관심사 태그 필터링',
          description: '사용자는 원하는 기술 스택(NestJS, React 등)과 모임 주기로 스터디를 손쉽게 검색·지원할 수 있다.',
          author: 'AI Co-Architect',
          votes: 3,
          votedBy: ['수민', '도윤', '민지'],
          comments: [],
          isAiDraft: true,
        },
        {
          id: `card-ai-${Date.now()}-3`,
          category: 'constraints',
          title: '동시 접속 500명 및 실시간 출석 이벤트 지연 < 100ms',
          description: '출석 체크 마감 직전 트래픽 스파이크 처리를 위해 Redis 캐싱 및 웹소켓 커넥션 최적화 필요',
          author: 'AI Co-Architect',
          votes: 4,
          votedBy: ['현우', '지훈', '민지', '도윤'],
          comments: [{ id: 'c2', author: '민지', text: 'Redis pub/sub과 인메모리 세션 스토어로 분산 대응', createdAt: '방금 전' }],
          isAiDraft: true,
        },
      ],
    };
  } else if (step === 2) {
    return {
      features: [
        {
          id: `FEAT-${String(Math.floor(Math.random() * 80) + 10)}`,
          domain: '출석 관리',
          name: '실시간 QR 출석 코드 생성 및 검증',
          priority: 'P0',
          assignee: '지훈',
          method: 'POST',
          endpoint: '/api/v1/studies/:id/attendance/verify',
          requestFields: 'qrToken: string, attendeeId: UUID, timestamp: number',
          responseFields: 'success: boolean, attendanceStatus: "PRESENT"|"LATE", recordedAt: ISO8601',
          summary: '15초 주기로 갱신되는 원타임 QR 코드를 스캔하여 본인 출석을 인증',
          isAiDraft: true,
        },
        {
          id: `FEAT-${String(Math.floor(Math.random() * 80) + 10)}`,
          domain: '보증금/정산',
          name: '스터디 종료 시 출석률 기반 보증금 정산',
          priority: 'P1',
          assignee: '민지',
          method: 'POST',
          endpoint: '/api/v1/studies/:id/settlement',
          requestFields: 'studyId: UUID, minimumRate: number',
          responseFields: 'refundList: Array<{ userId: UUID, amount: number }>',
          summary: '스터디 종료일에 기준 출석률 달성 멤버에게 예치금 자동 환급 계산',
          isAiDraft: true,
        },
      ],
    };
  } else if (step === 3) {
    return {
      nodes: [
        {
          id: `node-ai-${Date.now()}-1`,
          category: 'Service',
          name: 'Notification Worker',
          techStack: ['Node.js', 'BullMQ', 'FCM'],
          x: 480,
          y: 280,
          description: '스터디 시작 30분 전 알림 및 지각 위험자 자동 푸시 발송 비동기 워커',
          isAiDraft: true,
        },
        {
          id: `node-ai-${Date.now()}-2`,
          category: 'Messaging',
          name: 'Redis Queue & PubSub',
          techStack: ['Redis', 'BullMQ'],
          x: 720,
          y: 280,
          description: '알림 작업 큐 및 실시간 출석 이벤트 브로드캐스팅',
          isAiDraft: true,
        },
      ],
      connections: [
        {
          id: `conn-ai-${Date.now()}-1`,
          sourceId: 'node-gateway',
          targetId: `node-ai-${Date.now()}-1`,
          protocol: 'gRPC',
          label: '비동기 잡 큐잉',
        },
      ],
    };
  } else {
    return {
      tables: [
        {
          id: `tbl-ai-${Date.now()}-1`,
          name: 'study_deposits',
          comment: '스터디별 참여 보증금 납부 및 환급 트랜잭션 기록',
          relatedFeatureIds: ['FEAT-02', 'FEAT-05'],
          x: 540,
          y: 420,
          isAiDraft: true,
          columns: [
            {
              id: 'c-1',
              name: 'id',
              dataType: 'UUID',
              isPrimaryKey: true,
              isForeignKey: false,
              isUnique: true,
              isNullable: false,
              comment: '보증금 거래 식별자',
            },
            {
              id: 'c-2',
              name: 'study_id',
              dataType: 'UUID',
              isPrimaryKey: false,
              isForeignKey: true,
              references: 'studies.id',
              isUnique: false,
              isNullable: false,
              comment: '참조 스터디 ID',
            },
            {
              id: 'c-3',
              name: 'user_id',
              dataType: 'UUID',
              isPrimaryKey: false,
              isForeignKey: true,
              references: 'users.id',
              isUnique: false,
              isNullable: false,
              comment: '납부 유저 ID',
            },
            {
              id: 'c-4',
              name: 'deposit_amount',
              dataType: 'BIGINT',
              isPrimaryKey: false,
              isForeignKey: false,
              isUnique: false,
              isNullable: false,
              defaultValue: '0',
              comment: '예치 금액(KRW)',
            },
            {
              id: 'c-5',
              name: 'status',
              dataType: 'VARCHAR(30)',
              isPrimaryKey: false,
              isForeignKey: false,
              isUnique: false,
              isNullable: false,
              defaultValue: "'HOLD'",
              comment: '상태 (HOLD, REFUNDED, FORFEITED)',
            },
            {
              id: 'c-6',
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              isPrimaryKey: false,
              isForeignKey: false,
              isUnique: false,
              isNullable: false,
              defaultValue: 'CURRENT_TIMESTAMP',
              comment: '생성 시각',
            },
          ],
        },
      ],
    };
  }
}

// AI Draft Endpoint
app.post('/api/ai/draft', async (req, res) => {
  const { step, projectSummary, previousContext } = req.body;

  if (!ai || !process.env.GEMINI_API_KEY) {
    const fallback = generateFallbackDraft(Number(step) || 1, projectSummary || '', previousContext || {});
    return res.json({ success: true, source: 'fallback', draft: fallback });
  }

  try {
    let systemInstruction = `당신은 5인 애자일 개발팀의 수석 소프트웨어 아키텍트 "SyncArch AI Co-Architect"입니다.
실용적이고(오버엔지니어링 지양), 앞 단계 컨텍스트와 긴밀히 추적 가능한 설계 초안을 JSON으로 생성하세요.`;

    let prompt = `[프로젝트 개요]: ${projectSummary || '사내 스터디 매칭 & 출석 관리 플랫폼'}
[대상 단계]: Step ${step}
[이전 단계 설계 컨텍스트]: ${JSON.stringify(previousContext || {}, null, 2)}

요구사항:
Step ${step}에 맞는 최적의 설계 초안 2~3개 항목을 제안하세요.`;

    let responseSchema: any;

    if (step === 1) {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['problems_goals', 'actors', 'user_stories', 'constraints'] },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                author: { type: Type.STRING },
                votes: { type: Type.INTEGER },
              },
              required: ['id', 'category', 'title', 'description', 'author'],
            },
          },
        },
        required: ['cards'],
      };
    } else if (step === 2) {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          features: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                domain: { type: Type.STRING },
                name: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ['P0', 'P1', 'P2'] },
                assignee: { type: Type.STRING },
                method: { type: Type.STRING, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                endpoint: { type: Type.STRING },
                requestFields: { type: Type.STRING },
                responseFields: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ['id', 'domain', 'name', 'priority', 'assignee', 'method', 'endpoint', 'summary'],
            },
          },
        },
        required: ['features'],
      };
    } else if (step === 3) {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['Client', 'Service', 'DataStore', 'Messaging', 'Infra'] },
                name: { type: Type.STRING },
                techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
              },
              required: ['id', 'category', 'name', 'techStack', 'description'],
            },
          },
        },
        required: ['nodes'],
      };
    } else {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          tables: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                comment: { type: Type.STRING },
                relatedFeatureIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                columns: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      dataType: { type: Type.STRING },
                      isPrimaryKey: { type: Type.BOOLEAN },
                      isForeignKey: { type: Type.BOOLEAN },
                      references: { type: Type.STRING },
                      isUnique: { type: Type.BOOLEAN },
                      isNullable: { type: Type.BOOLEAN },
                      defaultValue: { type: Type.STRING },
                      comment: { type: Type.STRING },
                    },
                    required: ['id', 'name', 'dataType', 'isPrimaryKey', 'isForeignKey', 'isNullable', 'comment'],
                  },
                },
              },
              required: ['id', 'name', 'comment', 'columns'],
            },
          },
        },
        required: ['tables'],
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.7,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    // Tag draft items with isAiDraft: true
    if (parsed.cards) parsed.cards.forEach((c: any) => (c.isAiDraft = true));
    if (parsed.features) parsed.features.forEach((f: any) => (f.isAiDraft = true));
    if (parsed.nodes) {
      parsed.nodes.forEach((n: any, idx: number) => {
        n.isAiDraft = true;
        n.x = 450 + idx * 240;
        n.y = 260 + (idx % 2) * 80;
      });
    }
    if (parsed.tables) {
      parsed.tables.forEach((t: any, idx: number) => {
        t.isAiDraft = true;
        t.x = 520 + (idx % 2) * 280;
        t.y = 400 + Math.floor(idx / 2) * 220;
      });
    }

    return res.json({ success: true, source: 'gemini', draft: parsed });
  } catch (err: any) {
    console.error('Gemini Draft Error, using fallback:', err.message);
    const fallback = generateFallbackDraft(Number(step) || 1, projectSummary || '', previousContext || {});
    return res.json({ success: true, source: 'fallback', draft: fallback, note: err.message });
  }
});

// Vite middleware or production static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`SyncArch Full-Stack Server running on port ${port}`);
  });
}

startServer();
