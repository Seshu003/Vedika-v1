'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, X, Send, Sparkles, Loader2, 
  Terminal, Code, AlertCircle, Info, HelpCircle, 
  ArrowRight, Shield, Zap, HelpCircle as HelpIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PersonalizedBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const pathname = usePathname();
  const chatEndRef = useRef(null);

  // Initialize session and user details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // User info from Frappe Auth
      const storedUser = localStorage.getItem('frappe_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {}
      }
      
      // Bot Session ID
      let botSession = localStorage.getItem('vyomanta_bot_session');
      if (!botSession) {
        botSession = 'bot-sess-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('vyomanta_bot_session', botSession);
      }
      setSession(botSession);
      
      // Initial Welcome Message
      const name = storedUser ? JSON.parse(storedUser).name : 'Student';
      setMessages([
        {
          role: 'assistant',
          content: `Hi ${name}! 👋 I am your personalized AI tutor bot. I can see what you are working on in any tab. Ask me to explain a code step, help you debug an error, or just teach you a programming concept!`
        }
      ]);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Read current active page context from window state
  const getActiveContext = () => {
    if (typeof window === 'undefined') return null;
    return window.__vyomanta_context || null;
  };

  const handleSendMessage = async (textToSend) => {
    const msgText = textToSend || input;
    if (!msgText.trim()) return;

    if (!textToSend) setInput('');

    const newMessages = [...messages, { role: 'user', content: msgText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const activeCtx = getActiveContext();
      let systemPrompt = "You are a helpful, encouraging, and highly intelligent Socratic AI coding assistant. You guide high school students (around 15 years old) to understand computer science principles, loops, lists, and labs. Rather than writing all the code for them directly, ask guiding questions, explain concepts, and give step-by-step hints.";
      
      let contextPrefix = "";
      if (includeContext && activeCtx) {
        contextPrefix = `[User Current Page Context]\n`;
        contextPrefix += `- Path: ${pathname}\n`;
        if (activeCtx.page === 'code-puzzle') {
          contextPrefix += `- Activity: Code Puzzle ("${activeCtx.puzzleTitle || 'Solving puzzle'}")\n`;
          contextPrefix += `- Problem Description: ${activeCtx.puzzleDesc || 'N/A'}\n`;
          contextPrefix += `- Current Step Description: ${activeCtx.stepDescription || 'N/A'}\n`;
          if (activeCtx.code) contextPrefix += `- Active Code:\n\`\`\`python\n${activeCtx.code}\n\`\`\`\n`;
          if (activeCtx.error) contextPrefix += `- Active Step Error: ${activeCtx.error}\n`;
          if (activeCtx.stdout) contextPrefix += `- Terminal Console Output: ${activeCtx.stdout}\n`;
        } else if (activeCtx.page === 'playground') {
          contextPrefix += `- Activity: Interactive Code Playground\n`;
          if (activeCtx.code) contextPrefix += `- Active Code:\n\`\`\`python\n${activeCtx.code}\n\`\`\`\n`;
          if (activeCtx.error) contextPrefix += `- Active Code Trace Error: ${activeCtx.error}\n`;
          if (activeCtx.stdout) contextPrefix += `- Terminal Console Output: ${activeCtx.stdout}\n`;
        } else {
          contextPrefix += `- Current Page: ${activeCtx.title || pathname}\n`;
        }
        contextPrefix += `\n[User's Question]\n${msgText}`;
      } else {
        contextPrefix = msgText;
      }

      let storedUserId = '';
      if (typeof window !== 'undefined') {
        storedUserId = localStorage.getItem('lms-user-id') || '';
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          user: contextPrefix,
          maxOutputTokens: 1500,
          sessionId: session,
          userId: storedUserId
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages([
        ...newMessages,
        { role: 'assistant', content: data.text }
      ]);
    } catch (e) {
      console.error(e);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: "⚠️ Sorry, I ran into a connection issue. Let's try that again!" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionType) => {
    const activeCtx = getActiveContext();
    if (!activeCtx) {
      handleSendMessage("Can you give me an overview of this page?");
      return;
    }

    if (actionType === 'explain') {
      handleSendMessage("Can you explain what my current code does in simple terms?");
    } else if (actionType === 'debug') {
      if (activeCtx.error) {
        handleSendMessage(`I got this error: "${activeCtx.error}". How can I debug this without giving me the direct solution code?`);
      } else {
        handleSendMessage("Can you double check my code for bugs or errors?");
      }
    } else if (actionType === 'hint') {
      handleSendMessage("I am a bit stuck. Can you give me a Socratic hint for my next step?");
    }
  };

  const activeCtx = getActiveContext();

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, fontFamily: 'var(--font-outfit), sans-serif' }}>
      <AnimatePresence>
        {/* Expandable chat assistant panel */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            style={{
              width: 380,
              height: 520,
              background: 'rgba(10, 15, 30, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              marginBottom: 16
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(15, 23, 42, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 10, height: 10, background: '#10B981', borderRadius: '50%', border: '2px solid #0B0F19', position: 'absolute', bottom: 0, right: 0, zIndex: 2 }} />
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #38BDF8, #6366F1)', display: 'flex', alignItems: 'center', justifyCenter: 'center', display: 'flex', justifyContent: 'center' }}>
                    <Sparkles size={14} color="#ffffff" fill="#ffffff" style={{ alignSelf: 'center' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 4 }}>
                    AI Companion
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>
                    Online • Socratic Mode
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4, borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Context HUD bar */}
            {activeCtx && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.06)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10.5,
                color: '#38BDF8',
                fontWeight: 700
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={11} />
                  <span>
                    Linked to: {activeCtx.page === 'code-puzzle' ? `Step [${activeCtx.currentStepIndex + 1}] of "${activeCtx.puzzleTitle}"` : activeCtx.page === 'playground' ? 'Code Playground' : pathname}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={includeContext} 
                    onChange={(e) => setIncludeContext(e.target.checked)}
                    style={{ accentColor: '#38BDF8', cursor: 'pointer' }}
                  />
                  Context
                </label>
              </div>
            )}

            {/* Messages scrolling box */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {messages.map((msg, index) => {
                const isAI = msg.role === 'assistant';
                return (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: isAI ? 'flex-start' : 'flex-end',
                      alignItems: 'flex-start',
                      gap: 8
                    }}
                  >
                    {isAI && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Sparkles size={11} color="#38BDF8" fill="#38BDF8" />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '80%',
                      background: isAI ? 'rgba(30, 41, 59, 0.5)' : '#38BDF8',
                      color: isAI ? '#E2E8F0' : '#0B0F19',
                      border: isAI ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                      borderRadius: isAI ? '0px 12px 12px 12px' : '12px 12px 0px 12px',
                      padding: '8px 12px',
                      fontSize: 12,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 size={11} color="#38BDF8" style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Bot is thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions Footer */}
            {activeCtx && (activeCtx.page === 'code-puzzle' || activeCtx.page === 'playground') && (
              <div style={{
                padding: '6px 12px',
                background: 'rgba(15, 23, 42, 0.2)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                gap: 6,
                overflowX: 'auto'
              }} className="no-scrollbar">
                <button 
                  onClick={() => handleQuickAction('explain')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 10,
                    color: '#8892B0',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#38BDF8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8892B0'}
                >
                  <Code size={10} />
                  Explain Code
                </button>
                <button 
                  onClick={() => handleQuickAction('debug')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 10,
                    color: '#8892B0',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F59E0B'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8892B0'}
                >
                  <AlertCircle size={10} />
                  Help Debug
                </button>
                <button 
                  onClick={() => handleQuickAction('hint')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 10,
                    color: '#8892B0',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#10B981'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8892B0'}
                >
                  <HelpCircle size={10} />
                  Get Hint
                </button>
              </div>
            )}

            {/* Input field */}
            <div style={{
              padding: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              gap: 8
            }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask your tutor companion..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#F8FAFC',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                style={{
                  background: input.trim() ? '#38BDF8' : 'rgba(255,255,255,0.05)',
                  color: input.trim() ? '#0B0F19' : '#64748B',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Send size={13} fill="currentColor" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating bubble toggle button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #38BDF8, #6366F1)',
          border: 'none',
          boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4), 0 0 15px rgba(56, 189, 248, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#ffffff',
          position: 'relative'
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={20} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageSquare size={20} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
