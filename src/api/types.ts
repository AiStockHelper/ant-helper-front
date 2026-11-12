// DESIGN.md 3장의 API 계약을 그대로 옮긴 타입.

export type AccountType = 'REAL_TRADE' | 'PAPER_TRADE'
export type Market = 'KRX' | 'NASDAQ' | 'NYSE' | 'AMEX'
export type Currency = 'KRW' | 'USD'
export type OrderScope = 'DOMESTIC' | 'OVERSEAS'

export interface PageResponse<T> {
  content: T[]
  hasNext: boolean
  totalPages: number
  totalElements: number
  page: number
  size: number
  isFirst: boolean
  isLast: boolean
}

export interface ApiEnvelope<T> {
  isSuccess: boolean
  status: string
  data?: T
  code?: string
  message?: string
  reasons?: string[]
}

// ── 인증 ──────────────────────────────────────────
export interface Me {
  id: number
  email: string
  nickname: string
  createdAt: string
}

/** 로그인 1단계 결과: 이메일로 인증번호를 보냈다. */
export interface LoginChallenge {
  challengeId: string
  maskedEmail: string
  expiresInSeconds: number
  resendAfterSeconds: number
}

export interface StepUpChallenge {
  challengeId: string
  expiresInSeconds: number
  resendAfterSeconds: number
  validMinutes: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  member: Me
}

// ── 계좌 ──────────────────────────────────────────
export interface Account {
  id: number
  accountType: AccountType
  alias: string
  accountNumberMasked: string
  accountProductCode: string
  isDefault: boolean
  createdAt: string
}

export interface AccountDetail extends Account {
  kisEnvironment: 'REAL' | 'VIRTUAL'
  tokenStatus: 'VALID' | 'EXPIRED' | 'UNKNOWN'
}

export interface CreateAccountRequest {
  accountType: AccountType
  alias?: string
  appKey: string
  secretKey: string
  accountNumber: string
  accountProductCode: string
}

export interface Holding {
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  quantity: number
  sellableQuantity: number
  averagePrice: number
  currentPrice: number
  purchaseAmount: number
  evaluationAmount: number
  profitLoss: number
  profitLossRate: number
}

export interface AccountSummary {
  accountId: number
  cash: number
  totalPurchaseAmount: number
  totalEvaluationAmount: number
  totalAssets: number
  profitLoss: number
  profitLossRate: number
  holdings: Holding[]
  asOf: string
  /** 해외(USD) 잔고. 조회되지 않으면 null */
  overseas?: MarketSummary | null
  /** USD/KRW 참고 환율 */
  exchangeRate?: number | null
}

export interface MarketSummary {
  currency: Currency
  cash: number
  totalPurchaseAmount: number
  totalEvaluationAmount: number
  totalAssets: number
  profitLoss: number
  profitLossRate: number
  holdings: Holding[]
}

export type OrderSide = 'BUY' | 'SELL'
export type OrderStatus = 'FILLED' | 'PARTIAL' | 'PENDING' | 'CANCELED' | 'REJECTED'

export interface OrderHistoryItem {
  orderNo: string
  orderedAt: string
  side: OrderSide
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  orderQuantity: number
  orderPrice: number
  executedQuantity: number
  averageExecutedPrice: number
  status: OrderStatus
}

// ── 종목 ──────────────────────────────────────────
export interface StockSearchItem {
  productNumber: string
  name: string
  nameEn?: string
  market: Market | string
  currency?: Currency
}

export interface Quote {
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  price: number
  change: number
  changeRate: number
  open: number
  high: number
  low: number
  volume: number
  asOf: string
}

export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Direction = 'UP' | 'DOWN' | 'FLAT'
export type SignalTone = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

export interface Prediction {
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  currentPrice: number
  predictedPrice: number
  predictedChangeRate: number
  direction: Direction
  confidence: number
  summary: string
  signals: { name: string; value: string; tone: SignalTone }[]
  horizon: 'NEXT_DAY'
  asOf: string
}

export interface Recommendation {
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  currentPrice: number
  score: number
  predictedChangeRate: number
  direction: Direction
  confidence: number
  reasons: string[]
  /** 야간 분석 기준 거래일(yyyy-MM-dd). 실시간 분석이면 없음 */
  asOf?: string | null
}

// ── 채팅 ──────────────────────────────────────────
export interface Conversation {
  id: number
  title: string
  pinned: boolean
  accountId: number | null
  lastMessagePreview: string | null
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'USER' | 'ASSISTANT'
export type MessageStatus = 'COMPLETE' | 'STREAMING' | 'STOPPED' | 'ERROR'

export interface ToolCall {
  id: string
  name: string
  label: string
  status: 'RUNNING' | 'DONE' | 'ERROR'
  summary?: string
}

export type CardType =
  | 'quote'
  | 'candles'
  | 'prediction'
  | 'recommendations'
  | 'search'
  | 'balance'
  | 'holdings'
  | 'orders'
  | 'order_result'
  | 'agent_tasks'
  | 'llm_recommendations'

export interface Card {
  type: CardType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export type ActionKind = 'ORDER' | 'AGENT_TASK' | 'AGENT_TASK_UPDATE' | 'SCHEDULED_ORDER' | 'SCHEDULED_RECOMMEND_BUY'
export type ActionStatus = 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'FAILED' | 'EXPIRED'

export interface Action {
  id: number
  kind: ActionKind
  status: ActionStatus
  title: string
  summary: string
  accountId: number
  accountType: AccountType
  accountLabel: string
  details: { label: string; value: string }[]
  result?: { success: boolean; message: string; orderNo?: string }
  expiresAt: string
  createdAt: string
}

export interface Message {
  id: number
  role: MessageRole
  content: string
  status: MessageStatus
  toolCalls: ToolCall[]
  cards: Card[]
  actions: Action[]
  model: string | null
  createdAt: string
}

export type ConversationDetail = Conversation & { messages: Message[] }

export interface OrderResultData {
  success: boolean
  message: string
  orderNo?: string
  /** 빈 문자열이면 주문 취소 결과 */
  side: OrderSide | ''
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  quantity: number
  price?: number | null
}

export interface LlmPick {
  productNumber: string
  name: string
  market?: Market
  currency?: Currency
  currentPrice: number
  /** 모델이 분석한 전체 종목 중 순위(1부터). 순위가 없으면 null */
  modelRank?: number | null
  modelTotal?: number | null
  /** 모델 추천(상위)에 포함된 종목인가 */
  inModelTop: boolean
  /** 모델 분석 결과가 있는가 */
  modelAnalyzed: boolean
  modelScore?: number | null
  modelDirection?: Direction | null
  modelPredictedChangeRate?: number | null
  reason: string
  outlook: string
}

export interface LlmPicksData {
  picks: LlmPick[]
}

export interface CandlesCardData {
  productNumber?: string
  name?: string
  market?: Market
  currency?: Currency
  period?: 'D' | 'W' | 'M'
  candles: Candle[]
}

// ── 자동 실행 / 스킬 ───────────────────────────────
export type AgentStatus = 'ACTIVE' | 'RUNNING' | 'PAUSED' | 'DONE' | 'CANCELED'

export interface Schedule {
  type: 'ONCE' | 'DAILY' | 'MARKET_EVENT' | 'MARKET_INTERVAL'
  runAt?: string
  time?: string
  days?: string[]
  zone?: string
  market?: string
  event?: string
  offsetMinutes?: number
  intervalMinutes?: number
  startOffsetMinutes?: number
  endOffsetMinutes?: number
}

export interface Ledger {
  currency: Currency
  budget: number
  available: number
  invested: number
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  totalPnlPct: number
  openPositions: number
  boughtToday: number
  maxPositionPct?: number
  maxLossPct?: number
  maxDailyBuy?: number
}

export interface AgentTask {
  id: number
  accountId: number
  accountType: AccountType | null
  accountLabel: string
  skillId?: string | null
  skillName?: string | null
  title: string
  instruction?: string | null
  status: AgentStatus
  pausedReason?: string | null
  autonomous: boolean
  schedule: Schedule
  scheduleLabel: string
  nextRunAt?: string | null
  lastRunAt?: string | null
  lastResult?: string | null
  runCount: number
  failCount: number
  conversationId?: number | null
  createdBy: 'USER' | 'AGENT'
  parentTaskId?: number | null
  config: Record<string, unknown>
  ledger?: Ledger | null
  createdAt: string
}

export interface AgentPosition {
  id: number
  market: Market
  currency: Currency
  symbol: string
  name: string
  quantity: number
  avgPrice: number
  lastPrice?: number | null
  pnlPct: number
  unrealizedPnl: number
  realizedPnl: number
  status: 'OPEN' | 'CLOSED' | 'RELEASED'
  openedAt: string
  closedAt?: string | null
  exitReason?: string | null
}

export interface AgentTrade {
  id: number
  side: 'BUY' | 'SELL'
  market: Market
  currency: Currency
  symbol: string
  name: string
  quantity: number
  price: number
  amount: number
  reason?: string | null
  createdAt: string
}

export interface AgentRun {
  id: number
  status: 'DONE' | 'FAILED' | 'SKIPPED'
  manual: boolean
  startedAt: string
  finishedAt: string
  summary?: string | null
  events: string[]
}

export interface AgentTaskDetail {
  task: AgentTask
  positions: AgentPosition[]
  trades: AgentTrade[]
  runs: AgentRun[]
  memory?: string | null
  /** 정리본을 고치기 전의 모습들(최신순) */
  revisions?: AgentRevision[]
}

/** 지시(정리본)를 고치기 전의 내용 */
export interface AgentRevision {
  at: string
  by: string
  title: string | null
  instruction: string | null
}

export interface SkillParam {
  key: string
  label: string
  type: 'NUMBER' | 'TEXT' | 'SELECT' | 'BOOLEAN'
  defaultValue?: string | number | boolean | null
  min?: number | null
  max?: number | null
  options?: { value: string; label: string }[] | null
  help?: string | null
  required: boolean
  unit?: string | null
}

export interface Skill {
  id: string
  name: string
  summary: string
  detail: string
  category: string
  trades: boolean
  params: SkillParam[]
}

/**
 * 자동 실행 수정 요청. 보낸 항목만 바뀐다.
 * 스킬 작업은 config(바꿀 설정값만)로 시드·일정·한도가 다시 계산되고, 일반 작업은 한도(budget 등)·일정을 직접 바꾼다.
 * 실전 계좌의 자율 주문 작업에서 설정·한도·일정을 바꿀 땐 confirmRealTrading 이 필요하다.
 */
export interface UpdateAgentTaskRequest {
  title?: string
  instruction?: string
  mode?: 'REPLACE' | 'APPEND'
  config?: Record<string, unknown>
  budget?: number
  maxPositionPct?: number
  maxLossPct?: number
  maxDailyBuy?: number
  schedule?: Schedule
  confirmRealTrading?: boolean
}

export interface CreateAgentTaskRequest {
  accountId: number
  skillId: string
  config: Record<string, unknown>
  confirmRealTrading?: boolean
}
// ── SSE ───────────────────────────────────────────
export interface MetaEventData {
  conversation: Conversation
  userMessage: Message
  assistantMessageId: number
}

export type ChatStreamEvent =
  | { event: 'meta'; data: MetaEventData }
  | { event: 'delta'; data: { text: string } }
  | { event: 'tool'; data: ToolCall }
  | { event: 'card'; data: Card }
  | { event: 'action'; data: Action }
  | { event: 'title'; data: { title: string } }
  | { event: 'done'; data: { message: Message } }
  | { event: 'error'; data: { code: string; message: string } }

// ── 주문 큐 ───────────────────────────────────────
export type OrderRequestStatus = 'SENDING' | 'RETRY_WAIT' | 'SUCCESS' | 'FAILED'

export interface OrderRequestItem {
  id: number
  accountId: number
  accountName: string
  source: 'CHAT_ACTION' | 'AGENT' | 'MANUAL'
  market: Market
  currency: Currency
  symbol: string
  name: string | null
  side: OrderSide
  quantity: number
  limitPrice: number | null
  status: OrderRequestStatus
  attempts: number
  maxRetries: number
  nextAttemptAt: string | null
  failureKind: string | null
  lastError: string | null
  orderNo: string | null
  createdAt: string
  completedAt: string | null
}