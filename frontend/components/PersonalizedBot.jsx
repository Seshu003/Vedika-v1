  'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  MessageSquare, X, Send, Sparkles, Loader2, 
  Terminal, Code, AlertCircle, Info, HelpCircle, 
  ArrowRight, Shield, Zap, HelpCircle as HelpIcon,
  Home, BookOpen, Award, FileText, FolderOpen, Brain, Code2, Briefcase, BarChart3, Atom, FlaskConical, Dna
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import Mascot2D from './Mascot2D';
import { 
  getStudentEnrollments, 
  getQuizSubmissions, 
  getAssignmentSubmissions,
  getCourses
} from '@/lib/frappe';



const getContextSpeech = (path) => {
  if (path.includes('playground')) return "Welcome to the Code Playground! 💻 Let's test some ideas.";
  if (path.includes('code-puzzle') || path.includes('labs')) return "A code puzzle! 🧩 Need a hint? Ask me.";
  if (path.includes('lesson')) return "Let's read this lesson together! 📖 Ask if anything is unclear.";
  if (path.includes('profile') || path.includes('progress')) return "Wow, look at all your progress! 🌟 Keep it up.";
  return "Hi! 👋";
};

export default function PersonalizedBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const chatEndRef = useRef(null);

  const [isDesktopConnected, setIsDesktopConnected] = useState(false);
  const [spinningHighlightIndex, setSpinningHighlightIndex] = useState(null);
  const [isMenuSpinning, setIsMenuSpinning] = useState(false);

  const studentProgressRef = useRef(null);
  const [ageSyncKey, setAgeSyncKey] = useState(0);

  useEffect(() => {
    const handleStorageChange = () => {
      setAgeSyncKey(prev => prev + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const loadStudentStats = async (email, username) => {
    try {
      const [enrollments, quizSubs, assSubs, allCourses, progressRes] = await Promise.all([
        getStudentEnrollments(email).catch(() => []),
        getQuizSubmissions().catch(() => []),
        getAssignmentSubmissions().catch(() => []),
        getCourses().catch(() => []),
        fetch(`/api/progress?email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ completed: {} }))
      ]);

      const published = allCourses.filter(c => c.status === 'Published');
      const enrolled = published.filter(c => enrollments.includes(c.id));
      const userQuizSubs = quizSubs.filter(s => s.member === username);
      const userAssSubs = assSubs.filter(s => s.member === username);

      studentProgressRef.current = {
        enrolledCourses: enrolled.map(c => c.title || c.id),
        completedLessons: Object.keys(progressRes.completed || {}),
        quizAttempts: userQuizSubs.map(s => ({ quiz: s.quiz, score: `${s.percentage}%`, passed: s.percentage >= s.passing_percentage })),
        assignmentAttempts: userAssSubs.map(s => ({ assignment: s.assignment, status: s.status }))
      };
      console.log('[PersonalizedBot] Student academic stats loaded:', studentProgressRef.current);
    } catch (e) {
      console.error('[PersonalizedBot] Stats load error:', e);
    }
  };

  const getDefaultActionForPage = (path) => {

    if (path === '/coding-tutor' || path === '/code-puzzle' || path.startsWith('/lesson') || path === '/assignments') {
      return 'typing';
    }
    if (path === '/courses' || path.startsWith('/courses')) {
      return 'reading';
    }
    if (path === '/quizzes') {
      return 'writing';
    }
    if (path === '/jobs') {
      return 'searching';
    }
    if (path === '/resources') {
      return 'searching';
    }
    if (path === '/progress') {
      return 'celebrating';
    }
    if (path === '/general-tutor') {
      return 'wave';
    }
    return 'idle';
  };

  // Miniature Animation States
  const [currentAction, setCurrentAction] = useState(() => getDefaultActionForPage(pathname));
  const [frame, setFrame] = useState(0);
  const [speechText, setSpeechText] = useState('');
  const [showSpeech, setShowSpeech] = useState(false);
  const speechTimeoutRef = useRef(null);
  const lastInteractionTimeRef = useRef(Date.now());
  const typingTimeoutRef = useRef(null);

  const resetInactivityTimer = () => {
    lastInteractionTimeRef.current = Date.now();
  };

  const [isNavigating, setIsNavigating] = useState(false);
  const [navTargetName, setNavTargetName] = useState('');

  const dragControls = useDragControls();
  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [flyCoords, setFlyCoords] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  const [botPos, setBotPos] = useState({
    isUpperHalf: false,
    isLeftHalf: false
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
          setCurrentAction('thinking');
          triggerSpeech("Listening... Speak your command! 🎙️");
        };

        rec.onresult = (event) => {
          const result = event.results[0];
          if (result && result.isFinal) {
            const transcript = result[0].transcript;
            console.log('[Voice] Final recognition result:', transcript);
            handleSendMessage(transcript);
          }
        };

        rec.onerror = (event) => {
          console.error('[Voice] Recognition error:', event.error);
          setIsListening(false);
          setCurrentAction(getDefaultActionForPage(pathname));
          triggerSpeech("Sorry, I didn't catch that. 🎙️");
        };

        rec.onend = () => {
          setIsListening(false);
          setCurrentAction(getDefaultActionForPage(pathname));
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleVoiceListening = () => {
    resetInactivityTimer();
    if (!recognitionRef.current) {
      alert("Voice recognition is not supported in this browser. Try Google Chrome!");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsOpen(true);
      recognitionRef.current.start();
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const dragConstraints = {
    left: -windowSize.width + 120,
    right: 20,
    top: -windowSize.height + 160,
    bottom: 20
  };

  const triggerSpeech = (text) => {
    setSpeechText(text);
    setShowSpeech(true);
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    speechTimeoutRef.current = setTimeout(() => {
      setShowSpeech(false);
    }, 5000);
  };

  const jumpVariants = {
    jump: {
      y: [0, -15, 0],
      transition: { duration: 0.6, ease: "easeOut" }
    },
    idle: {
      y: [0, -3, 0],
      transition: { duration: 2.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
    },
    thinking: {
      y: [0, -2, 0],
      transition: { duration: 0.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
    }
  };

  const wsRef = useRef(null);
  const localWsRef = useRef(null);
  const [isDesktopLocalConnected, setIsDesktopLocalConnected] = useState(false);

  // Maintain real-time sync with local desktop mascot companion directly on port 7001
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let socket = null;
    let reconnectTimeout = null;

    const connectLocalWs = () => {
      console.log('[WebSync] Connecting to local desktop mascot at ws://localhost:7001...');
      socket = new WebSocket('ws://localhost:7001');
      localWsRef.current = socket;

      socket.onopen = () => {
        console.log('[WebSync] Connected to local desktop mascot directly');
        setIsDesktopLocalConnected(true);
        // Sync the current tab with the local desktop companion upon connection
        const cleanTab = pathname.replace(/\//g, '') || 'dashboard';
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ event: 'tab_change', tab: cleanTab }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSync] Received local companion event:', data);

          if (data.event === 'navigate') {
            const page = data.page;
            const routeNames = {
              dashboard: '/',
              courses: '/courses',
              quizzes: '/courses?tab=quizzes',
              assignments: '/courses?tab=assignments',
              resources: '/courses?tab=resources',
              'general-tutor': '/vedika-ai/general-tutor',
              'coding-tutor': '/vedika-ai/coding-tutor',
              'code-puzzle': '/vedika-ai/code-puzzle',
              'viva-interview': '/viva-interview',
              progress: '/progress',
              'physics-lab': '/vedika-labs/physics',
              'chemistry-lab': '/vedika-labs/chemistry',
              'biology-lab': '/vedika-labs/biology',
            };
            const targetRoute = routeNames[page];
            if (targetRoute) {
              setNavTargetName(page);
              triggerSpeech(`Navigating to ${page}...`);
              triggerSpinAndNavigate(targetRoute);
            }
          } else if (data.event === 'openAITutor') {
            const tab = data.tab;
            const routeNames = {
              'general-tutor': '/vedika-ai/general-tutor',
              'coding-tutor': '/vedika-ai/coding-tutor',
              'code-puzzle': '/vedika-ai/code-puzzle',
            };
            const targetRoute = routeNames[tab];
            if (targetRoute) {
              setNavTargetName(tab);
              triggerSpeech(`Navigating to ${tab}...`);
              triggerSpinAndNavigate(targetRoute);
            }
          } else if (data.event === 'speech') {
            triggerSpeech(data.text);
          } else if (data.event === 'stateChange') {
            setCurrentAction(data.state);
          } else if (data.event === 'sleeping') {
            setCurrentAction('sleep');
          }
        } catch (e) {
          console.error('[WebSync] Local msg parse error:', e);
        }
      };

      socket.onclose = () => {
        console.log('[WebSync] Local desktop companion disconnected. Retrying in 5s...');
        setIsDesktopLocalConnected(false);
        reconnectTimeout = setTimeout(connectLocalWs, 5000);
      };

      socket.onerror = (err) => {
        // Silent error: do not spam console if mascot is not running locally
      };
    };

    connectLocalWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [pathname]);

  // Maintain real-time sync with desktop companion
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedId = null;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      storedId = urlParams.get('userId');
      if (storedId) {
        localStorage.setItem('lms-user-id', storedId);
      }
    }
    if (!storedId) {
      storedId = localStorage.getItem('lms-user-id');
    }
    if (!storedId) {
      storedId = 'user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem('lms-user-id', storedId);
    }

    const userAge = localStorage.getItem('lms-user-age') || '15';
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws?clientType=web&userId=${storedId}&age=${userAge}`;
    let socket = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      console.log('[WebSync] Connecting to server...', wsUrl);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('[WebSync] Connected for desktop companion synchronization');
        const cleanTab = pathname.replace(/\//g, '') || 'dashboard';
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'tab_change', tab: cleanTab }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'action' && msg.name === 'navigateToPage') {
            const page = msg.args?.page;
              const routeNames = {
                dashboard: '/',
                courses: '/courses',
                quizzes: '/courses?tab=quizzes',
                assignments: '/courses?tab=assignments',
                resources: '/courses?tab=resources',
                'general-tutor': '/vedika-ai/general-tutor',
                'coding-tutor': '/vedika-ai/coding-tutor',
                'code-puzzle': '/vedika-ai/code-puzzle',
                'viva-interview': '/viva-interview',
                progress: '/progress',
                'physics-lab': '/vedika-labs/physics',
                'chemistry-lab': '/vedika-labs/chemistry',
                'biology-lab': '/vedika-labs/biology',
              };
             const targetRoute = routeNames[page];
            if (targetRoute) {
              setNavTargetName(page);
              triggerSpeech(`Navigating to ${page}...`);
              triggerSpinAndNavigate(targetRoute);
            }
          } else if (msg.type === 'desktop_status') {
            console.log('[WebSync] Desktop status updated:', msg.connected);
            setIsDesktopConnected(msg.connected);
          } else if (msg.type === 'chat_command') {
            console.log('[WebSync] Voice chat command relayed from desktop:', msg.text);
            handleSendMessage(msg.text);
          }
        } catch (e) {
          console.error('[WebSync] Msg parse error:', e);
        }
      };

      socket.onclose = () => {
        console.log('[WebSync] Connection closed. Retrying in 4s...');
        reconnectTimeout = setTimeout(connectWs, 4000);
      };

      socket.onerror = (err) => {
        console.error('[WebSync] Socket error:', err);
      };
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [router, pathname, ageSyncKey]);

  // Report path/tab changes on route navigation
  useEffect(() => {
    const cleanTab = pathname.replace(/\//g, '') || 'dashboard';
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'tab_change', tab: cleanTab }));
    }
    if (localWsRef.current && localWsRef.current.readyState === WebSocket.OPEN) {
      localWsRef.current.send(JSON.stringify({ event: 'tab_change', tab: cleanTab }));
    }
  }, [pathname]);

  // Initialize session and user details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // User info from Frappe Auth
      const storedUser = localStorage.getItem('frappe_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          loadStudentStats(parsed.email || '', parsed.username || '');
        } catch (e) {}
      }

      // Bot Session ID
      let botSession = localStorage.getItem('vyomanta_bot_session');
      if (!botSession) {
        botSession = 'bot-sess-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('vyomanta_bot_session', botSession);
      }
      setSession(botSession);

      let storedId = localStorage.getItem('lms-user-id');
      if (!storedId) {
        storedId = 'user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        localStorage.setItem('lms-user-id', storedId);
      }
      
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

  // Listen for storage events (e.g. when age is verified/updated) and trigger mascot onboard sync
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem('frappe_user');
      const storedAge = localStorage.getItem('lms-user-age');
      if (storedUser && storedAge) {
        try {
          const parsed = JSON.parse(storedUser);
          let ageNum = 16;
          if (storedAge === '6-10') ageNum = 8;
          else if (storedAge === '11-14') ageNum = 12;
          else if (storedAge === '15+') ageNum = 16;
          
          import('@/lib/vedikaClient').then(({ vedika }) => {
            vedika.setUser(parsed.email || '');
            vedika.onboard(parsed.name || parsed.username || 'Student', ageNum);
          }).catch(() => {});
        } catch (e) {}
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      handleStorageChange();
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle random actions and inactivity greetings
  useEffect(() => {
    const actionInterval = setInterval(() => {
      if (isLoading) return;

      // Check for errors first in active context
      const activeCtx = getActiveContext();
      if (activeCtx?.error && Math.random() < 0.4 && !isOpen) {
        const errorQuotes = [
          "Uh oh, got a trace error! 🛠️ Let's debug.",
          "Need help fixing that error? 🔍",
          "A bug? Let's solve it together! 🧩"
        ];
        triggerSpeech(errorQuotes[Math.floor(Math.random() * errorQuotes.length)]);
        setCurrentAction('thinking');
        setTimeout(() => setCurrentAction(getDefaultActionForPage(pathname)), 2500);
        return;
      }

      // Check for inactivity greeting (if idle for 15+ seconds)
      const timeSinceInteraction = Date.now() - lastInteractionTimeRef.current;
      if (timeSinceInteraction >= 15000 && !isOpen) {
        const idleGreetings = [
          "Hi! 👋",
          "Hello! Let's write some code! 💻",
          "Hey there! Ready to learn? 🚀",
          "Hi! Need a hint? Click me! 💡",
          "Hi! Ask me anything! 🤖",
          "Stuck? I can help! 🛠️"
        ];
        const randomGreeting = idleGreetings[Math.floor(Math.random() * idleGreetings.length)];
        triggerSpeech(randomGreeting);

        // Always wave hands while saying greetings!
        setCurrentAction('wave');
        setTimeout(() => setCurrentAction(getDefaultActionForPage(pathname)), 2000);
        
        resetInactivityTimer();
        return;
      }

      // Standard periodic random movements
      const defaultPageAct = getDefaultActionForPage(pathname);
      const weightedActions = [
        defaultPageAct, defaultPageAct,
        'lookLeft', 'lookRight', 'wave', 'dance', 'jump'
      ];
      const randomAction = weightedActions[Math.floor(Math.random() * weightedActions.length)];
      setCurrentAction(randomAction);

      if (randomAction === 'lookLeft' || randomAction === 'lookRight') {
        setTimeout(() => setCurrentAction(defaultPageAct), 1500);
      } else if (randomAction === 'wave') {
        setTimeout(() => setCurrentAction(defaultPageAct), 2000);
      } else if (randomAction === 'dance') {
        setTimeout(() => setCurrentAction(defaultPageAct), 2500);
      } else if (randomAction === 'jump') {
        setTimeout(() => setCurrentAction(defaultPageAct), 600);
      }

      // 15% chance of showing a random quote when not idle greeting
      if (Math.random() < 0.15 && !isOpen) {
        const quotes = [
          "Let's learn some coding! 🚀",
          "Need a hint? Click me! 💡",
          "Drag me anywhere on the page! 🏃",
          "You're doing great! Keep it up! ✨",
          "Stuck? Let's debug together! 🛠️",
          "Did you know? Python was created by Guido van Rossum! 🐍",
          "Let's write some cool functions! 💻"
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        triggerSpeech(randomQuote);
      }
    }, 5000);

    return () => clearInterval(actionInterval);
  }, [isLoading, isOpen]);

  // Frame ticking for animations like waving/dancing
  useEffect(() => {
    if (currentAction === 'wave' || currentAction === 'dance' || isLoading) {
      const frameInterval = setInterval(() => {
        setFrame(prev => prev + 1);
      }, 250);
      return () => clearInterval(frameInterval);
    }
  }, [currentAction, isLoading]);

  // When bot is thinking, let's make him search/look left and right
  useEffect(() => {
    if (isLoading) {
      setCurrentAction('thinking');
    } else {
      setCurrentAction(getDefaultActionForPage(pathname));
    }
  }, [isLoading]);

  // Trigger speech on path change, log page visits history, and delay coordinate reset
  useEffect(() => {
    // Keep it at bottom-left corner briefly, then glide back home after 2.5s
    const timer = setTimeout(() => {
      setFlyCoords({ x: 0, y: 0 });
    }, 2500);

    // Track user website usage memory
    if (typeof window !== 'undefined') {
      try {
        const visits = JSON.parse(localStorage.getItem('vyomanta_page_history') || '[]');
        const currentPath = pathname;
        if (visits.length === 0 || visits[visits.length - 1].path !== currentPath) {
          const now = new Date();
          visits.push({
            path: currentPath,
            title: document.title || currentPath,
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toLocaleDateString()
          });
          // Limit to 15 history logs
          localStorage.setItem('vyomanta_page_history', JSON.stringify(visits.slice(-15)));
        }
      } catch (e) {
        console.error(e);
      }
    }

    const text = getContextSpeech(pathname);
    triggerSpeech(text);
    if (text.includes("Hi!")) {
      setCurrentAction('wave');
      setTimeout(() => setCurrentAction(getDefaultActionForPage(pathname)), 2000);
    } else {
      setCurrentAction(getDefaultActionForPage(pathname));
    }

    return () => clearTimeout(timer);
  }, [pathname]);

  // Periodically trigger random interactive gestures to make the bot feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      // Only trigger if bot is in a default page pose and NOT flying, clicking, dragging, or loading
      if (
        currentAction !== 'flying' &&
        currentAction !== 'clickSpin' &&
        !isOpen &&
        !isLoading
      ) {
        const gestures = ['dance', 'wave', 'celebrating', 'thinking', 'idle'];
        const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
        
        if (randomGesture !== 'idle') {
          setCurrentAction(randomGesture);
          // Return to default page pose after 2-4 seconds
          setTimeout(() => {
            setCurrentAction(getDefaultActionForPage(pathname));
          }, 2000 + Math.random() * 2000);
        }
      }
    }, 12000); // Trigger every 12 seconds
    return () => clearInterval(interval);
  }, [pathname, currentAction, isOpen, isLoading]);

  // Read current active page context from window state
  const getActiveContext = () => {
    if (typeof window === 'undefined') return null;
    return window.__vyomanta_context || null;
  };

  const activeCtx = getActiveContext();

  const handleSendMessage = async (textToSend) => {
    resetInactivityTimer();
    const msgText = textToSend || input;
    if (!msgText.trim()) return;

    if (!textToSend) setInput('');

    const newMessages = [...messages, { role: 'user', content: msgText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const ageGroup = (typeof window !== 'undefined' ? localStorage.getItem('lms-user-age') : '') || '15+';
      let systemPrompt = "You are VEDIKA, a helpful, encouraging, friendly, and highly intelligent female Socratic AI tutor and desktop companion. " +
        "You guide school students to understand computer science principles, loops, lists, and labs. Rather than writing all the code for them directly, ask guiding questions, explain concepts, and give step-by-step hints. Always refer to yourself as VEDIKA. " +
        `Your target student is in the age group: ${ageGroup}. Adapt your tone and vocabulary complexity accordingly: ` +
        (ageGroup === '6-10' ? "Speak like a very enthusiastic, warm, and playful cartoon companion. Use extremely simple words, fun analogies, and short sentences." :
         ageGroup === '11-14' ? "Speak clearly, using structured examples and relatable real-world descriptions." :
         "Use rigorous, analytical Socratic tutoring, providing code line-by-line analyses and Python concept breakdowns.") +
        " Additionally, you can perform client-side actions. If the student asks to open, navigate, start, or show a tab/page, you must append this exact action tag to the very end of your response: [ACTION: navigate, route: '/target-route'] where target-route is one of: '/' (dashboard), '/courses', '/general-tutor', '/coding-tutor', '/progress', '/code-puzzle', '/quizzes', '/resources', '/jobs'. For example, if they say 'open jobs', respond with a friendly message and append '[ACTION: navigate, route: '/jobs']'.";
      
      let contextPrefix = "";
      if (studentProgressRef.current) {
        contextPrefix += `[Student Academic Profile Context (VEDIKA Memory)]\n`;
        contextPrefix += `- Enrolled Courses: ${studentProgressRef.current.enrolledCourses.join(', ') || 'None'}\n`;
        contextPrefix += `- Completed Lessons Count: ${studentProgressRef.current.completedLessons.length}\n`;
        contextPrefix += `- Quiz Scores: ${studentProgressRef.current.quizAttempts.map(q => `${q.quiz}: ${q.score} (${q.passed ? 'Passed' : 'Failed'})`).join(', ') || 'None'}\n`;
        contextPrefix += `- Assignment Statuses: ${studentProgressRef.current.assignmentAttempts.map(a => `${a.assignment}: ${a.status}`).join(', ') || 'None'}\n\n`;
      }

      if (includeContext && activeCtx) {

        let pageHistoryText = '';
        if (typeof window !== 'undefined') {
          try {
            const visits = JSON.parse(localStorage.getItem('vyomanta_page_history') || '[]');
            if (visits.length > 0) {
              pageHistoryText = "- User's Recent Page Navigation History (in chronological order):\n" + 
                visits.slice(-8).map(v => `  * Visited "${v.title}" (${v.path}) at ${v.timestamp}`).join('\n') + '\n';
            }
          } catch (e) {
            console.error(e);
          }
        }

        contextPrefix = `[User Current Page Context]\n`;
        contextPrefix += pageHistoryText;
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

      const assistantResponse = data.text || '';
      const actionRegex = /\[ACTION:\s*navigate,\s*route:\s*'([^']+)'\]/;
      const match = assistantResponse.match(actionRegex);
      let cleanText = assistantResponse;
      let targetRoute = null;

      if (match) {
        targetRoute = match[1];
        cleanText = assistantResponse.replace(actionRegex, '').trim();
      }

      setMessages([
        ...newMessages,
        { role: 'assistant', content: cleanText }
      ]);

      // Relay speech output back to the desktop Cosmos companion
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'speech_response',
          text: cleanText
        }));
      }

      if (targetRoute) {
        // portal navigation overlay
        const routeNames = {
          '/': 'Dashboard',
          '/courses': 'Courses Portal',
          '/quizzes': 'Quizzes Arena',
          '/assignments': 'Assignments',
          '/resources': 'Resources Cheat Sheets',
          '/general-tutor': 'AI General Tutor',
          '/coding-tutor': 'AI Coding Tutor',
          '/code-puzzle': 'Code Puzzles',
          '/viva-interview': 'Viva & Interview',
          '/jobs': 'Jobs Arena',
          '/progress': 'Progress Dashboard'
        };
        const targetName = routeNames[targetRoute] || 'New Workspace';
        setNavTargetName(targetName);
        triggerSpeech(`Let's go to the ${targetName}! 🚀`);
        triggerSpinAndNavigate(targetRoute);
      }
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

  const handleDragStart = () => {
    isDragging.current = true;
    setIsDraggingState(true);
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      isDragging.current = false;
      setIsDraggingState(false);
    }, 100);
  };

  const handleBotClick = () => {
    if (isDragging.current) return;
    setIsOpen(!isOpen);
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

  const triggerSpinAndNavigate = (targetRoute) => {
    const targetIdx = MENU_ITEMS.findIndex(item => item.id === targetRoute);
    if (targetIdx === -1) {
      router.push(targetRoute);
      return;
    }

    setIsOpen(true);
    setIsMenuSpinning(true);
    setIsNavigating(true);
    setCurrentAction('dance');

    // 2 full rounds + target index
    const totalSteps = (MENU_ITEMS.length * 2) + targetIdx;
    let currentStep = 0;

    const spinStep = () => {
      if (currentStep <= totalSteps) {
        const idx = currentStep % MENU_ITEMS.length;
        setSpinningHighlightIndex(idx);

        const progress = currentStep / totalSteps;
        const delay = 35 + Math.pow(progress, 2.5) * 300;

        currentStep++;
        setTimeout(spinStep, delay);
      } else {
        setSpinningHighlightIndex(targetIdx);
        setIsMenuSpinning(false);

        setTimeout(() => {
          setIsNavigating(false);
          setIsOpen(false);
          setSpinningHighlightIndex(null);
          router.push(targetRoute);
        }, 500);
      }
    };

    spinStep();
  };

  const [hoveredIndex, setHoveredIndex] = useState(null);

  const MENU_ITEMS = [
    { id: '/',              Icon: Home,          label: 'Dashboard'     },
    { id: '/courses',       Icon: BookOpen,      label: 'Courses'       },
    { id: '/quizzes',       Icon: Award,         label: 'Quizzes'       },
    { id: '/assignments',   Icon: FileText,      label: 'Assignments'   },
    { id: '/resources',     Icon: FolderOpen,    label: 'Resources'     },
    { id: '/general-tutor', Icon: Brain,         label: 'Ask AI Tutor'  },
    { id: '/coding-tutor',  Icon: Code2,         label: 'Code AI Tutor' },
    { id: '/code-puzzle',   Icon: Zap,           label: 'Code Puzzle'   },
    { id: '/viva-interview', Icon: MessageSquare, label: 'Viva / Interview' },
    { id: '/jobs',          Icon: Briefcase,     label: 'Jobs'          },
    { id: '/progress',      Icon: BarChart3,     label: 'Progress'      },
    { id: '/labs/physics',   Icon: Atom,         label: 'Physics Lab'   },
    { id: '/labs/chemistry', Icon: FlaskConical, label: 'Chemistry Lab' },
    { id: '/labs/biology',   Icon: Dna,          label: 'Biology Lab'   },
  ];

  const radius = 130; // circular layout radius
  const isDraggingMascot = useRef(false);


  if (isDesktopLocalConnected || isDesktopConnected) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, fontFamily: 'var(--font-outfit), sans-serif' }}>
      
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            style={{
              position: 'absolute',
              bottom: 110,
              right: 0,
              width: 330,
              height: 480,
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1.5px solid rgba(56, 189, 248, 0.4)',
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.1)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 10002
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(30, 41, 59, 0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#38BDF8" />
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#F8FAFC' }}>VEDIKA AI</h3>
                  <span style={{ fontSize: 10, color: '#38BDF8', fontWeight: 600 }}>Socratic Companion</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#38BDF8' : 'rgba(255, 255, 255, 0.05)',
                  color: m.role === 'user' ? '#0B0F19' : '#E2E8F0',
                  borderRadius: 12,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  fontWeight: m.role === 'user' ? 600 : 500
                }}>
                  {m.content}
                </div>
              ))}
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                  <Loader2 size={14} className="animate-spin" color="#38BDF8" />
                  <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions */}
            {!isLoading && (
              <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflowX: 'auto', flexShrink: 0 }}>
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

      {/* Floating speech bubble */}
      <AnimatePresence>
        {showSpeech && speechText && !isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            style={{
              position: 'absolute',
              bottom: 120,
              right: 10,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              borderRadius: 14,
              color: '#f1f5f9',
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: 500,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              backdropFilter: 'blur(10px)',
              maxWidth: 220,
              minWidth: 150,
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            {speechText}
            <div style={{
              position: 'absolute',
              bottom: -8,
              right: 35,
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid rgba(15, 23, 42, 0.9)'
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circular portal menu */}
      <AnimatePresence>
        {isNavigating && (
          <div style={{
            position: 'absolute',
            bottom: -30,
            right: -30,
            width: 160,
            height: 160,
            pointerEvents: 'none',
            zIndex: 9998
          }}>
            {MENU_ITEMS.map((item, idx) => {
              const angle = (idx * 2 * Math.PI) / MENU_ITEMS.length;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isHighlighted = idx === spinningHighlightIndex;
              return (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: isHighlighted ? 'rgba(56, 189, 248, 0.95)' : 'rgba(15, 23, 42, 0.85)',
                    border: isHighlighted ? '2.5px solid #ffffff' : '1.5px solid rgba(56, 189, 248, 0.5)',
                    boxShadow: isHighlighted ? '0 0 20px rgba(56, 189, 248, 0.8)' : '0 4px 10px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isHighlighted ? '#0b0f19' : '#38bdf8',
                    pointerEvents: 'auto',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => router.push(item.id)}
                >
                  <item.Icon size={16} />
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Draggable mascot button */}
      <motion.div
        drag
        dragConstraints={dragConstraints}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleBotClick}
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 15px rgba(56, 189, 248, 0.15)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          position: 'absolute',
          bottom: 0,
          right: 0,
          zIndex: 10001,
          pointerEvents: 'auto'
        }}
        whileHover={{ scale: 1.06, borderColor: 'rgba(56, 189, 248, 0.6)' }}
        whileTap={{ scale: 0.96, cursor: 'grabbing' }}
      >
        <Mascot2D
          action={isDraggingState ? 'flying' : currentAction}
          isDragging={isDraggingState}
          isError={activeCtx?.error ? true : false}
          isThinking={isLoading}
        />
      </motion.div>
    </div>
  );
}

