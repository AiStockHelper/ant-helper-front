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
  | 'scheduled_tasks'

export interface Card {
  type: CardType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export type ActionKind = 'ORDER' | 'SCHEDULED_ORDER' | 'SCHEDULED_RECOMMEND_BUY'
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

export interface CandlesCardData {
  productNumber?: string
  name?: string
  market?: Market
  currency?: Currency
  period?: 'D' | 'W' | 'M'
  candles: Candle[]
}

export type ScheduledTaskStatus = 'SCHEDULED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED'

export interface ScheduledTask {
  id: number
  accountId: number
  accountType: AccountType
  kind: 'ORDER' | 'RECOMMEND_BUY'
  title: string
  runAt: string
  status: ScheduledTaskStatus
  params: Record<string, unknown>
  resultMessage?: string
  executedAt?: string
  createdAt: string
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
