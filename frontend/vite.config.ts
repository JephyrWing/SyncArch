import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // [앱 설정] AI Studio에서는 DISABLE_HMR 환경변수로 HMR을 끈다.
      // 수정 금지 - 에이전트가 편집하는 동안 화면 깜빡임을 막으려고 파일 감시를 끈다.
      hmr: process.env.DISABLE_HMR !== 'true',
      // [앱 설정] DISABLE_HMR가 true면 에이전트 편집 중 CPU를 아끼려고 파일 감시를 끈다.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // [앱 설정] 프론트 코드는 /api 상대 URL을 쓰고, 개발 중에는 Flask가 5000 포트에서 처리한다.
      proxy: {
        '/api': 'http://127.0.0.1:5000',
      },
    },
  };
});
