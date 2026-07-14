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

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws?clientType=web&userId=${storedId}`;
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
  }, [router, pathname]);

  // Report path/tab changes on route navigation
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const cleanTab = pathname.replace(/\//g, '') || 'dashboard';
      wsRef.current.send(JSON.stringify({ type: 'tab_change', tab: cleanTab }));
    }
  }, [pathname]);

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
      const activeCtx = getActiveContext();
      let systemPrompt = "You are a helpful, encouraging, and highly intelligent Socratic AI coding assistant. You guide high school students (around 15 years old) to understand computer science principles, loops, lists, and labs. Rather than writing all the code for them directly, ask guiding questions, explain concepts, and give step-by-step hints. " +
        "Additionally, you can perform client-side actions. If the student asks to open, navigate, start, or show a tab/page, you must append this exact action tag to the very end of your response: [ACTION: navigate, route: '/target-route'] where target-route is one of: '/' (dashboard), '/courses', '/general-tutor', '/coding-tutor', '/progress', '/code-puzzle', '/quizzes', '/resources', '/jobs'. For example, if they say 'open jobs', respond with a friendly message and append '[ACTION: navigate, route: '/jobs']'.";
      
      let contextPrefix = "";
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
    { id: '/jobs',          Icon: Briefcase,     label: 'Jobs'          },
    { id: '/progress',      Icon: BarChart3,     label: 'Progress'      },
    { id: '/labs/physics',   Icon: Atom,         label: 'Physics Lab'   },
    { id: '/labs/chemistry', Icon: FlaskConical, label: 'Chemistry Lab' },
    { id: '/labs/biology',   Icon: Dna,          label: 'Biology Lab'   },
  ];

  const radius = 130; // circular layout radius
  const isDraggingMascot = useRef(false);

  const handleDragStart = () => {
    isDraggingMascot.current = true;
    setIsDraggingState(true);
  };

  const handleDragEnd = () => {
    setIsDraggingState(false);
    setTimeout(() => {
      isDraggingMascot.current = false;
    }, 100);
  };

  const handleBotClick = () => {
    if (isDraggingMascot.current) return;
    if (isDesktopConnected) return;
    setIsOpen(!isOpen);
  };

  return null;
}

