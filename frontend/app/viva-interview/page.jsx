'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, Brain, Code, Database, Sparkles, HelpCircle,
  Award, MessageSquare, RefreshCw, Mic, MicOff, CheckCircle2, AlertTriangle, BookOpen, UserCheck
} from 'lucide-react';
import { T } from '@/lib/lms-data';
import { vedika } from '@/lib/vedikaClient';

const TOPICS = [
  { id: 'python',       title: 'Python',       Icon: Code,          desc: 'Variables, loops, functions, lists & OOP' },
  { id: 'javascript',   title: 'JavaScript',   Icon: Sparkles,      desc: 'Closures, promises, DOM, events & async' },
  { id: 'sql',          title: 'SQL Database', Icon: Database,      desc: 'Queries, joins, groups, subqueries & indexes' },
  { id: 'dsa',          title: 'DSA',          Icon: Brain,         desc: 'Arrays, lists, stacks, trees & sort algorithms' },
  { id: 'java',         title: 'Java Core',    Icon: Award,         desc: 'Inheritance, interfaces, threads & memory' },
  { id: 'cpp',          title: 'C++ OOP',      Icon: Code,          desc: 'Pointers, templates, memory & encapsulation' },
  { id: 'webdev',       title: 'Web Dev',      Icon: BookOpen,      desc: 'HTTP, CSS Flexbox, DOM, APIs & security' },
];

export default function VivaInterviewPage() {
  const [step, setStep] = useState('setup'); // 'setup' | 'loading' | 'session' | 'summary'
  const [topic, setTopic] = useState('python');
  const [mode, setMode] = useState('viva'); // 'viva' | 'interview'
  
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  
  // State for session history
  const [sessionHistory, setSessionHistory] = useState([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  
  // State for hint
  const [hint, setHint] = useState('');
  const [hintLoading, setHintLoading] = useState(false);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-IN';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = () => setIsListening(false);
        rec.onresult = (event) => {
          const text = event.results[0][0].transcript;
          setUserAnswer(prev => prev + (prev ? ' ' : '') + text);
        };
        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Generate Questions via VEDIKA AI Proxy
  const handleStart = async () => {
    setStep('loading');
    const systemPrompt = `You are an expert ${mode === 'viva' ? 'viva voice examiner' : 'technical job interviewer'}. 
Your task is to generate exactly 5 distinct, highly relevant questions for a student tested on the topic of "${topic}".
Mode Rules:
- If mode is "viva", the questions should be conceptual, straightforward definitions suitable for school or college viva examinations. E.g., "What is mutability in programming?"
- If mode is "interview", the questions should be practical, scenario-based, or algorithmic, suitable for technical software engineering job interviews. E.g., "How would you optimize a database query containing nested subqueries?"

Return your output ONLY as a valid JSON array of strings containing the 5 questions. Example: ["Q1", "Q2", "Q3", "Q4", "Q5"]`;

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          user: `Generate 5 random ${mode === 'viva' ? 'conceptual viva' : 'technical job interview'} questions for the topic: ${topic}.`,
          maxOutputTokens: 2000
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Extract JSON array
      const text = data.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        setQuestions(arr);
        setCurrentIdx(0);
        setUserAnswer('');
        setSessionHistory([]);
        setCurrentFeedback(null);
        setHint('');
        setStep('session');
      } else {
        throw new Error("Could not parse JSON array from model output.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate questions. Please verify your internet connection or try again!");
      setStep('setup');
    }
  };

  // Request a hint via VEDIKA AI
  const handleGetHint = async () => {
    if (hintLoading || hint) return;
    setHintLoading(true);
    const systemPrompt = `You are a Socratic tutor assisting a student who is stuck on a viva question: "${questions[currentIdx]}".
Give a short, helpful hint (1-2 sentences max) that points the student in the right direction without giving away the direct answer.`;

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          user: `Give me a Socratic hint for: "${questions[currentIdx]}"`,
          maxOutputTokens: 200
        })
      });
      const data = await res.json();
      if (data.text) {
        setHint(data.text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHintLoading(false);
    }
  };

  // Submit and Evaluate Answer via VEDIKA AI
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || evalLoading) return;
    setEvalLoading(true);
    
    const question = questions[currentIdx];
    const systemPrompt = `You are an expert ${mode === 'viva' ? 'viva examiner' : 'technical job interviewer'} grading a student's answer.
Question: "${question}"
Student's Answer: "${userAnswer}"

Evaluate the answer. Return your feedback ONLY in the following JSON format:
{
  "score": <integer from 0 to 10>,
  "feedback": "<detailed, constructive feedback highlighting missing key terms, errors, or suggestions>",
  "sampleAnswer": "<a perfect, model response to the question>"
}
Keep the JSON valid. Do not wrap in markdown code blocks.`;

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          user: `Evaluate my answer. Question: "${question}", My Answer: "${userAnswer}"`,
          maxOutputTokens: 2000
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const text = data.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setCurrentFeedback(parsed);
      } else {
        throw new Error("Could not parse JSON response.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to grade the answer. Please try again!");
    } finally {
      setEvalLoading(false);
    }
  };

  // Move to next question or complete session
  const handleNext = () => {
    const updatedHistory = [
      ...sessionHistory,
      {
        question: questions[currentIdx],
        answer: userAnswer,
        score: currentFeedback.score,
        feedback: currentFeedback.feedback,
        sampleAnswer: currentFeedback.sampleAnswer
      }
    ];
    setSessionHistory(updatedHistory);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setUserAnswer('');
      setCurrentFeedback(null);
      setHint('');
    } else {
      // End session, sync score to local mascot database
      const totalScore = updatedHistory.reduce((sum, item) => sum + item.score, 0);
      const averagePercent = Math.round((totalScore / (questions.length * 10)) * 100);

      // Onboarding user email sync
      const storedUser = localStorage.getItem('frappe_user');
      const email = storedUser ? JSON.parse(storedUser).email : 'local_user';
      
      vedika.setUser(email);
      vedika.sendActivity('submit_quiz', '/', {
        quizTopic: `Viva: ${topic.toUpperCase()} (${mode})`,
        quizScore: averagePercent
      }).catch(() => {});

      setStep('summary');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'var(--green)';
    if (score >= 5) return 'var(--amber)';
    return 'var(--red)';
  };

  const averageScore = sessionHistory.length > 0 
    ? (sessionHistory.reduce((sum, item) => sum + item.score, 0) / sessionHistory.length).toFixed(1) 
    : 0;

  return (
    <div style={{
      padding: '40px 24px',
      maxWidth: 800,
      margin: '0 auto',
      minHeight: '100vh',
      fontFamily: 'var(--font-outfit), sans-serif',
      color: 'var(--text)'
    }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #EC4899 0%, #D946EF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)'
          }}>
            <MessageSquare size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Viva & Interview Challenge
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              Practice voice conceptual questions or mock software job interviews.
            </p>
          </div>
        </div>
        {step !== 'setup' && (
          <button 
            onClick={() => setStep('setup')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              color: 'var(--muted)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        
        {/* ── SETUP SCREEN ── */}
        {step === 'setup' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
          >
            {/* Mode selection card */}
            <div style={{
              background: 'var(--s1)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>1. Choose Session Mode</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                
                <div 
                  onClick={() => setMode('viva')}
                  style={{
                    border: `1.5px solid ${mode === 'viva' ? 'var(--purple)' : 'var(--border)'}`,
                    background: mode === 'viva' ? 'rgba(155, 110, 248, 0.08)' : 'var(--bg)',
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} color={mode === 'viva' ? 'var(--purple)' : 'var(--muted)'} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Academic Viva Mode</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                    School/college style conceptual questions. Shorter, direct conceptual grading with helpful hints.
                  </span>
                </div>

                <div 
                  onClick={() => setMode('interview')}
                  style={{
                    border: `1.5px solid ${mode === 'interview' ? 'var(--accent)' : 'var(--border)'}`,
                    background: mode === 'interview' ? 'rgba(91, 140, 248, 0.08)' : 'var(--bg)',
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserCheck size={16} color={mode === 'interview' ? 'var(--accent)' : 'var(--muted)'} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Job Interview Mode</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                    Professional coding, design, and scenario questions. Evaluates core terminology, complexity, and clarity.
                  </span>
                </div>

              </div>
            </div>

            {/* Topic Grid */}
            <div style={{
              background: 'var(--s1)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>2. Select Core Topic</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {TOPICS.map((t) => {
                  const isSelected = topic === t.id;
                  return (
                    <div 
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      style={{
                        background: isSelected ? 'rgba(236, 72, 153, 0.08)' : 'var(--bg)',
                        border: `1.5px solid ${isSelected ? '#EC4899' : 'var(--border)'}`,
                        borderRadius: 12,
                        padding: 16,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: isSelected ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <t.Icon size={18} color={isSelected ? '#EC4899' : 'var(--muted)'} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{t.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Launch Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #EC4899 0%, #D946EF 100%)',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(236, 72, 153, 0.3)'
              }}
            >
              Start {mode === 'viva' ? 'Viva' : 'Interview'} Q&A Session 🚀
            </motion.button>
          </motion.div>
        )}

        {/* ── LOADING SCREEN ── */}
        {step === 'loading' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 0',
              gap: 20
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: '#EC4899',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>Analyzing Syllabus...</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
                VEDIKA AI is preparing 5 random technical {mode} questions on {topic.toUpperCase()}...
              </p>
            </div>
          </motion.div>
        )}

        {/* ── ACTIVE SESSION ── */}
        {step === 'session' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Progress bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                <span>{topic.toUpperCase()} - {mode.toUpperCase()} MODE</span>
                <span>Question {currentIdx + 1} of {questions.length}</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${((currentIdx + 1) / questions.length) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #EC4899 0%, #D946EF 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Question panel */}
            <div style={{
              background: 'var(--s1)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#EC4899', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Question Prompt
              </span>
              <h2 style={{ fontSize: 19, fontWeight: 700, marginTop: 8, marginBottom: 0, lineHeight: 1.4, color: 'var(--text)' }}>
                {questions[currentIdx]}
              </h2>
            </div>

            {/* Answer Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Your Answer:</span>
                {mode === 'viva' && (
                  <button
                    onClick={handleGetHint}
                    disabled={hintLoading || !!hint}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: hint ? 'var(--muted)' : 'var(--accent)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: hint ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <HelpCircle size={14} /> {hintLoading ? 'Loading hint...' : hint ? 'Hint loaded' : 'Get Hint'}
                  </button>
                )}
              </div>

              {/* Socratic Hint Display */}
              {hint && (
                <div style={{
                  background: 'rgba(91, 140, 248, 0.06)',
                  border: '1px solid rgba(91, 140, 248, 0.2)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 13,
                  color: 'var(--accent)',
                  lineHeight: 1.4
                }}>
                  <strong>Hint:</strong> {hint}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <textarea
                  rows={6}
                  placeholder={mode === 'viva' ? "Explain the concept in a few sentences..." : "Provide a professional technical response or explain your algorithmic approach..."}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={evalLoading || currentFeedback !== null}
                  style={{
                    width: '100%',
                    background: 'var(--s1)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 12,
                    padding: 16,
                    color: 'var(--text)',
                    fontSize: 14.5,
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    resize: 'none',
                    outline: 'none',
                    transition: 'border 0.2s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#EC4899'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                
                {/* Speech Dictation Button */}
                {recognitionRef.current && currentFeedback === null && (
                  <button
                    onClick={toggleListening}
                    style={{
                      position: 'absolute',
                      bottom: 16,
                      right: 16,
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isListening ? 'var(--red)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isListening ? 'var(--red)' : 'var(--border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isListening ? '#fff' : 'var(--muted)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s'
                    }}
                    title={isListening ? "Stop Listening" : "Dictate Answer"}
                  >
                    {isListening ? <MicOff size={16} color="#fff" /> : <Mic size={16} />}
                  </button>
                )}
              </div>
            </div>

            {/* Action trigger button */}
            {currentFeedback === null ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim() || evalLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #EC4899 0%, #D946EF 100%)',
                  color: '#fff',
                  fontSize: 14.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: (!userAnswer.trim() || evalLoading) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {evalLoading ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
                    VEDIKA AI is evaluating answer...
                  </>
                ) : (
                  <>Submit Response for Evaluation <ArrowRight size={16} /></>
                )}
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--s1)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}
              >
                {/* Score gauge and heading */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    border: `4px solid ${getScoreColor(currentFeedback.score)}22`,
                    borderTopColor: getScoreColor(currentFeedback.score),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 18,
                    color: getScoreColor(currentFeedback.score)
                  }}>
                    {currentFeedback.score}/10
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text)' }}>
                      {currentFeedback.score >= 8 ? 'Excellent Answer!' : currentFeedback.score >= 5 ? 'Good Effort!' : 'Concept Gaps Identified'}
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Instant VEDIKA AI Socratic Evaluation</span>
                  </div>
                </div>

                {/* Feedback Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Constructive Feedback</span>
                  <p style={{ fontSize: 13.5, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                    {currentFeedback.feedback}
                  </p>
                </div>

                {/* Model Answer Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Ideal Model Response</span>
                  <div style={{
                    background: 'var(--s2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 16,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: 'var(--muted)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5
                  }}>
                    {currentFeedback.sampleAnswer}
                  </div>
                </div>

                {/* Next button */}
                <button
                  onClick={handleNext}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #EC4899 0%, #D946EF 100%)',
                    color: '#fff',
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  {currentIdx === questions.length - 1 ? 'Finish & Generate Scorecard' : 'Proceed to Next Question'} <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── SUMMARY SCORECARD ── */}
        {step === 'summary' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: 'var(--s1)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 24,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Success icon & Title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(34, 197, 160, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--green)'
              }}>
                <CheckCircle2 size={44} />
              </div>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: 'var(--text)' }}>
                  Practice Session Completed!
                </h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  You have successfully completed the {topic.toUpperCase()} {mode} session.
                </p>
              </div>
            </div>

            {/* Score Display */}
            <div style={{ display: 'flex', gap: 40, margin: '16px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: getScoreColor(parseFloat(averageScore)) }}>
                  {averageScore}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                  Average Rating
                </span>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>
                  {questions.length}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                  Questions Answered
                </span>
              </div>
            </div>

            {/* Mascot sync note */}
            <div style={{
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 12.5,
              color: 'var(--muted)'
            }}>
              <Sparkles size={16} color="var(--green)" />
              <span>Result reported directly to your local companion mascot!</span>
            </div>

            {/* Review of all Q&A */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left', marginTop: 12 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Q&A Detailed Summary</h4>
              {sessionHistory.map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.4, color: 'var(--text)' }}>
                      Q{idx + 1}: {item.question}
                    </h5>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: getScoreColor(item.score),
                      flexShrink: 0
                    }}>
                      Rating: {item.score}/10
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    <strong>Your Response:</strong> "{item.answer}"
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 8, lineHeight: 1.4 }}>
                    <strong>Feedback:</strong> {item.feedback}
                  </div>
                </div>
              ))}
            </div>

            {/* Finish action */}
            <button
              onClick={() => setStep('setup')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #EC4899 0%, #D946EF 100%)',
                color: '#fff',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 12
              }}
            >
              <RefreshCw size={16} /> Practice Another Topic
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
