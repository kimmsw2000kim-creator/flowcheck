import { create } from 'zustand';

export interface ChatbotPromptRequest {
  id: number;
  prompt: string;
}

interface ChatbotState {
  isOpen: boolean;
  pendingRequest: ChatbotPromptRequest | null;
  toggleChatbot: () => void;
  closeChatbot: () => void;
  openWithPrompt: (prompt: string) => void;
  consumePrompt: (requestId: number) => void;
}

let promptSequence = 0;

export const useChatbotStore = create<ChatbotState>((set) => ({
  isOpen: false,
  pendingRequest: null,
  toggleChatbot: () => set((state) => ({ isOpen: !state.isOpen })),
  closeChatbot: () => set({ isOpen: false }),
  openWithPrompt: (prompt) => {
    promptSequence += 1;
    set({
      isOpen: true,
      pendingRequest: { id: promptSequence, prompt },
    });
  },
  consumePrompt: (requestId) => set((state) => ({
    pendingRequest: state.pendingRequest?.id === requestId
      ? null
      : state.pendingRequest,
  })),
}));
