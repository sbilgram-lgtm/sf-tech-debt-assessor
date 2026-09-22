import React, { useState, useEffect, useRef } from 'react';
import { AssessmentResult } from '../types/assessment';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  assessment: AssessmentResult | null;
}

export const AiChatPanel: React.FC<Props> = ({ visible, onClose, assessment }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastUserMessageRef = useRef<string>('');

  useEffect(() => {
    if (visible && assessment && !initializedRef.current && messages.length === 0) {
      initializedRef.current = true;
      sendMessage("Give me a brief summary of this org's top 3 most critical issues and their estimated remediation effort.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, assessment]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    if (!assessment) return null;
    return {
      orgName: assessment.orgName,
      orgType: assessment.orgType,
      isSandbox: assessment.isSandbox,
      overallPercentage: assessment.overallPercentage,
      categories: assessment.categories.map(c => ({
        category: c.category,
        percentage: c.percentage,
        items: c.items.map(item => ({
          severity: item.severity,
          title: item.title,
          description: item.description,
        }))
      }))
    };
  };

  const sendMessage = async (text: string) => {
    if (isStreaming) return;
    lastUserMessageRef.current = text;

    const userMsg: Message = { role: 'user', text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);

    const assistantMsg: Message = { role: 'assistant', text: '', streaming: true };
    setMessages([...updatedMessages, assistantMsg]);

    const history = updatedMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: m.text
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, history, assessmentContext: buildContext() })
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', text: 'Error: Could not reach AI service.' }
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                fullText = 'Error: ' + parsed.error;
              } else if (parsed.text) {
                fullText += parsed.text;
              }
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', text: fullText, streaming: true }
              ]);
            } catch (e) {
              // ignore malformed chunks
            }
          }
        }
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', text: fullText, streaming: false }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', text: 'Error: ' + err.message }
      ]);
    }

    setIsStreaming(false);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
      height: '100vh',
      backgroundColor: 'white',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #ecf0f1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#2c3e50',
        color: 'white'
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>Ask AI</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '2px' }}>Powered by Gemini</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.4rem',
            lineHeight: 1,
            padding: '4px 8px',
            borderRadius: '4px',
            opacity: 0.8
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#95a5a6', fontSize: '0.875rem', textAlign: 'center', marginTop: '40px' }}>
            Loading assessment context...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              backgroundColor: msg.role === 'user' ? '#3498db' : (msg.text.startsWith('Error:') ? '#fdf0ed' : '#f8f9fa'),
              color: msg.role === 'user' ? 'white' : (msg.text.startsWith('Error:') ? '#c0392b' : '#2c3e50'),
              fontSize: '0.875rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              border: msg.role === 'assistant' ? (msg.text.startsWith('Error:') ? '1px solid #c0392b' : '1px solid #ecf0f1') : 'none'
            }}>
              {msg.text}
              {msg.streaming && <span style={{ opacity: 0.5 }}>▊</span>}
            </div>
            {msg.role === 'assistant' && msg.text.startsWith('Error:') && !isStreaming && (
              <button
                onClick={() => {
                  setMessages(prev => prev.slice(0, -1));
                  sendMessage(lastUserMessageRef.current);
                }}
                style={{
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  border: '1px solid #c0392b',
                  backgroundColor: 'white',
                  color: '#c0392b',
                  cursor: 'pointer'
                }}
              >
                Try again
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 2 && !isStreaming && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            'What are the quick wins?',
            'AppExchange readiness risks?',
            'Estimate total remediation effort',
          ].map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid #3498db',
                backgroundColor: 'white',
                color: '#3498db',
                cursor: 'pointer'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #ecf0f1',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this org..."
          disabled={isStreaming}
          rows={2}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #bdc3c7',
            fontSize: '0.875rem',
            resize: 'none',
            fontFamily: 'inherit',
            outline: 'none',
            backgroundColor: isStreaming ? '#f8f9fa' : 'white'
          }}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: isStreaming || !input.trim() ? '#bdc3c7' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            whiteSpace: 'nowrap'
          }}
        >
          {isStreaming ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
