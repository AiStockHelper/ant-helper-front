import { createContext, useContext } from 'react'

export interface ChatUiContextValue {
  /** 카드 안의 버튼 등에서 새 사용자 메시지를 보낸다 */
  sendMessage: (text: string) => void
  busy: boolean
}

export const ChatUiContext = createContext<ChatUiContextValue>({ sendMessage: () => {}, busy: false })

export function useChatUi() {
  return useContext(ChatUiContext)
}
