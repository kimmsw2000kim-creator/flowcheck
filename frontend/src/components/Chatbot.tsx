import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../api/client';
import './Chatbot.css';

interface Message { id: number; text: string; sender: 'user' | 'bot'; }

const Chatbot = () => {
  const panelId = `chatbot-${useId().replace(/:/g, '')}`;
  const titleId = `${panelId}-title`;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: '안녕하세요. FlowCheck AI 도우미입니다. 무엇을 도와드릴까요?', sender: 'bot' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeChat = (restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChat();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const userMessage: Message = { id: Date.now(), text, sender: 'user' };
    setMessages((current) => [...current, userMessage]);
    setInputValue('');
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/chat', { message: userMessage.text });
      setMessages((current) => [...current, { id: Date.now() + 1, text: response.data.response || '응답을 받지 못했습니다.', sender: 'bot' }]);
    } catch (error) {
      console.error('Chatbot API Error:', error);
      setMessages((current) => [...current, { id: Date.now() + 1, text: '서버와 통신하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', sender: 'bot' }]);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="chatbot-container">
      {isOpen && (
        <section id={panelId} className="chatbot-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header className="chatbot-header">
            <div><span>FLOWCHECK</span><h2 id={titleId}>AI 도우미</h2></div>
            <button type="button" className="chatbot-close-btn" onClick={() => closeChat()} aria-label="챗봇 닫기">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          </header>
          <div className="chatbot-messages" aria-live="polite" aria-busy={isLoading} aria-relevant="additions">
            {messages.map((message) => <div key={message.id} className={`chat-message ${message.sender}`}>
              {message.sender === 'bot' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown> : message.text}
            </div>)}
            {isLoading && <div className="chatbot-loading"><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /><span className="sr-only">답변을 작성하고 있습니다.</span></div>}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="chatbot-input-form">
            <label className="sr-only" htmlFor={`${panelId}-input`}>메시지</label>
            <input ref={inputRef} id={`${panelId}-input`} type="text" className="fc-input chatbot-input" placeholder="메시지를 입력하세요" value={inputValue} onChange={(event) => setInputValue(event.target.value)} disabled={isLoading} />
            <button type="submit" className="chatbot-send-btn" disabled={!inputValue.trim() || isLoading}>전송</button>
          </form>
        </section>
      )}
      <button ref={triggerRef} type="button" className="chatbot-fab" onClick={() => isOpen ? closeChat(false) : setIsOpen(true)} aria-label={isOpen ? '챗봇 닫기' : '챗봇 열기'} aria-expanded={isOpen} aria-controls={panelId}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={isOpen ? 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' : 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H6l-2 2V4h16v12Z'} /></svg>
      </button>
    </div>
  );
};

export default Chatbot;
