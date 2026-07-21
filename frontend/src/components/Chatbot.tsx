import ChatbotPage from '../pages/ChatbotPage';
import { useChatbotStore } from '../store/chatbotStore';
import checkcheckiImg from '../assets/checkchecki.png';
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
        {isOpen ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <img src={checkcheckiImg} alt="챗봇 아이콘" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.4)' }} />
        )}
      </button>
    </div>
  );
};

export default Chatbot;
