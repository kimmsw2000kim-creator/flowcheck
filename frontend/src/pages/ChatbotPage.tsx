import React, { useCallback, useState, useEffect, useRef } from 'react';
import { ArrowUp, Loader2, Menu, Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../styles/chatbot.module.css';
import apiClient from '../api/client';
import type { ChatbotPromptRequest } from '../store/chatbotStore';

interface Message {
  messageId: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

interface Session {
  sessionId: string;
  title: string;
  updatedAt: string;
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const codeContent = String(children).replace(/\n$/, '');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className={styles.codeBlockWrapper}>
        <div className={styles.codeBlockHeader}>
          <span className={styles.codeLang}>{match[1]}</span>
          <button onClick={handleCopy} className={styles.copyBtn} title="코드 복사">
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className={styles.codePre}>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  }
  
  return (
    <code className={`${className || ''} ${styles.inlineCode}`} {...props}>
      {children}
    </code>
  );
};

interface ChatbotPageProps {
  initialPromptRequest?: ChatbotPromptRequest | null;
  onInitialPromptConsumed?: (requestId: number) => void;
}

const ChatbotPage: React.FC<ChatbotPageProps> = ({
  initialPromptRequest,
  onInitialPromptConsumed,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handledPromptIdRef = useRef<number | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/chat/sessions');
      setSessions(res.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    try {
      const res = await apiClient.get(`/api/chat/sessions/${sessionId}/messages`);
      setMessages(res.data);
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  };

  const handleSendMessage = useCallback(async (messageOverride?: string) => {
    const messageText = messageOverride ?? inputText;
    if (!messageText.trim()) return;

    const userMessage: Message = { messageId: Date.now(), role: 'USER', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/api/chat/send', {
        sessionId: currentSessionId,
        message: messageText
      });
      
      const data = response.data;
      setMessages(prev => [...prev, {
        messageId: data.messageId,
        role: data.role,
        content: data.content
      }]);

      if (!currentSessionId && data.sessionId) {
        setCurrentSessionId(data.sessionId);
        void fetchSessions();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, fetchSessions, inputText]);

  useEffect(() => {
    if (
      !initialPromptRequest
      || handledPromptIdRef.current === initialPromptRequest.id
    ) {
      return;
    }

    handledPromptIdRef.current = initialPromptRequest.id;
    onInitialPromptConsumed?.(initialPromptRequest.id);
    void handleSendMessage(initialPromptRequest.prompt);
  }, [handleSendMessage, initialPromptRequest, onInitialPromptConsumed]);

  return (
    <div className={styles.chatContainer}>
      <button 
        className={styles.menuToggleBtn} 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title="사이드바 열기/닫기"
      >
        <Menu size={24} />
      </button>
      <aside className={`${styles.sidebar} ${isSidebarOpen ? '' : styles.collapsed}`}>
        <button className={styles.newChatBtn} onClick={() => { setCurrentSessionId(null); setMessages([]); }}>
          + 새 채팅
        </button>
        <div className={styles.sessionListHeader}>이전 대화 목록</div>
        <div className={styles.sessionList}>
          {sessions.map(s => (
            <div 
              key={s.sessionId} 
              className={`${styles.sessionItem} ${currentSessionId === s.sessionId ? styles.active : ''}`}
              onClick={() => loadSession(s.sessionId)}
            >
              {s.title}
            </div>
          ))}
        </div>
      </aside>
      
      <main className={styles.chatMain}>
        <div className={styles.messageList}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <h2>AI 첵첵이에게 무엇이든 물어보세요</h2>
              <p>이전 테스트 이력을 바탕으로 최적화된 답변을 제공합니다.</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.messageId} className={`${styles.messageWrapper} ${msg.role === 'USER' ? styles.user : styles.assistant}`}>
              <div className={`${styles.messageBubble} ${styles.markdownBody}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className={styles.loading}>
              <Loader2 size={16} className={styles.spinner} />
              답변을 생성하고 있습니다...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className={styles.inputArea}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSendMessage()}
            placeholder="메시지를 입력하세요..."
            className={styles.inputField}
          />
          <button onClick={() => void handleSendMessage()} disabled={isLoading} className={styles.sendBtn}>
            <ArrowUp size={24} />
          </button>
        </div>
      </main>
    </div>
  );
};

export default ChatbotPage;
