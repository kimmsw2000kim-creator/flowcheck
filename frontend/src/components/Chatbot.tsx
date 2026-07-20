import ChatbotPage from '../pages/ChatbotPage';
import { useChatbotStore } from '../store/chatbotStore';
import './Chatbot.css';

const Chatbot = () => {
  const isOpen = useChatbotStore((state) => state.isOpen);
  const pendingRequest = useChatbotStore((state) => state.pendingRequest);
  const toggleChatbot = useChatbotStore((state) => state.toggleChatbot);
  const closeChatbot = useChatbotStore((state) => state.closeChatbot);
  const consumePrompt = useChatbotStore((state) => state.consumePrompt);

  return (
    <div className="chatbot-container">
      {isOpen && (
        <div className="chatbot-overlay-window">
          <button 
            type="button" 
            className="chatbot-close-overlay-btn" 
            onClick={closeChatbot}
            aria-label="챗봇 닫기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24" fill="white">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
          <div className="chatbot-page-wrapper">
             <ChatbotPage
               initialPromptRequest={pendingRequest}
               onInitialPromptConsumed={consumePrompt}
             />
          </div>
        </div>
      )}
      <button 
        type="button" 
        className="chatbot-fab" 
        onClick={toggleChatbot}
        aria-label={isOpen ? '챗봇 닫기' : '챗봇 열기'} 
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={isOpen ? 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' : 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H6l-2 2V4h16v12Z'} />
        </svg>
      </button>
    </div>
  );
};

export default Chatbot;
