# Ant Helper Web

채팅 중심 주식 어시스턴트 프론트엔드. Vite + React 18 + TypeScript(strict) + Tailwind 3 + react-router v6 + TanStack Query.
API 계약은 `../docs/DESIGN.md` 를 따른다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000, /api -> http://localhost:8080 프록시, 같은 네트워크의 휴대폰에서도 접속 가능
npm run build      # tsc --noEmit && vite build
npm run test       # vitest (SSE 파서, 포맷 유틸)
npm run icons      # public/icons/*.png 재생성 (public/icon.svg 와 같은 도형)
```

모든 화면은 실제 백엔드(`/api`)와만 통신한다. 채팅 답변은 백엔드가 실제 LLM(GPT, 실패 시 Claude)으로 생성한 것만 표시한다.

## 환경변수

| 이름 | 기본값 | 설명 |
|------|--------|------|
| `VITE_API_BASE_URL` | `''` | 비우면 Vite proxy 사용 |
| `VITE_PROXY_TARGET` | `http://localhost:8080` | dev 서버가 `/api` 를 넘길 백엔드 주소 |

## 구조

```
src/
  api/        client.ts(fetch 래퍼·토큰·401 refresh 1회), sse.ts(POST SSE 파서), endpoints.ts, types.ts(DESIGN.md 타입)
  components/ AppShell, AccountSelect, ui/(Button, Dialog, Popover, Toast, ...), finance/(목록·도넛 등)
  features/   auth, chat(useChat 스트리밍 상태, 카드, 확인 카드), portfolio, accounts, settings
  lib/        format.ts(formatKRW, formatRate ...), clipboard, cn
```
