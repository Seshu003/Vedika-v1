const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const next = require('next');
const { GoogleGenAI, Modality } = require('@google/genai');
const { Redis } = require('@upstash/redis');
require('dotenv').config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4
].filter(Boolean);

const globalKeyCooldowns = new Map();
const COOLDOWN_MS = 60000;
function markKeyFailed(key) {
  if (key) {
    globalKeyCooldowns.set(key, Date.now() + COOLDOWN_MS);
  }
}

let connectionCount = 0;

function getGeminiClient() {
  if (GEMINI_KEYS.length === 0) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }
  // Rotate key round-robin based on incoming connection count to distribute concurrent free-tier session load
  const apiKey = GEMINI_KEYS[connectionCount % GEMINI_KEYS.length];
  connectionCount++;
  console.log(`[VoiceWSCombined] Routing connection using Gemini Key index ${(connectionCount - 1) % GEMINI_KEYS.length}`);
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
let redis = null;
if (redisUrl && redisToken) {
  redis = new Redis({ url: redisUrl, token: redisToken });
}

async function loadMemoryContext(sessionId, userId) {
  if (!redis) return '';
  try {
    const [history, memories] = await Promise.all([
      redis.get(`chat:${sessionId}`).then(d => Array.isArray(d) ? d : []).catch(() => []),
      redis.get(`memories:${userId}`).then(d => Array.isArray(d) ? d : []).catch(() => []),
    ]);
    let ctx = '';
    if (history.length > 0) {
      ctx += '\n\nConversation history from this session:\n';
      ctx += history.map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
    }
    if (memories.length > 0) {
      ctx += '\n\nRelevant memories about this student (from past sessions):\n';
      ctx += memories.map(f => `- ${f}`).join('\n');
    }
    return ctx;
  } catch { return ''; }
}

function analyzeSentiment(text) {
  const lowercase = text.toLowerCase();
  const confusedWords = ["don't understand","do not understand","dont understand","not sure","confused","cannot get","cant get","difficult","hard","stuck","doubt","explain again","unclear","lost","struggling","help","confusing","అర్థం కాలేదు","కష్టంగా ఉంది","సందేహం","తెలియదు","మళ్ళీ చెప్పండి","కన్ఫ్యూజ్","ardham raledu","artham kaledu","kashtanga undi","malli cheppandi","samajh nahi","mushkil","kathin","shanka","phirse","phir se","pareshani","confuse","sandeha"];
  const positiveWords = ["understand","got it","easy","awesome","perfect","clear","great","wow","fantastic","amazing","makes sense","thank you","thanks","excellent","brilliant","అర్థమైంది","సులభంగా ఉంది","చాలా బాగుంది","థాంక్స్","సూపర్","అవును","ardhamaindi","sulabhanga undi","chala bagundi","samajh gaya","samajh gya","aasan","saral","badhiya","bahut achha","clear hai","dhanyawad","shukriya"];
  const curiousWords = ["what is","how do","tell me about","why is","curious","interested","learn","know","question","ఏమిటి","ఎలా","ఎందుకు","తెలుసుకోవాలి","emiti","ela","enduku","telusukovali","kya hai","kaise","kyun","jaan na"];
  let confusedCount = 0, positiveCount = 0, curiousCount = 0;
  for (const w of confusedWords) { if (lowercase.includes(w)) confusedCount++; }
  for (const w of positiveWords) { if (lowercase.includes(w)) positiveCount++; }
  for (const w of curiousWords) { if (lowercase.includes(w)) curiousCount++; }
  if (confusedCount > positiveCount && confusedCount >= curiousCount)
    return { label: 'Struggling / Confused', score: -0.6, emoji: '\uD83D\uDE1F' };
  if (positiveCount > confusedCount && positiveCount >= curiousCount)
    return { label: 'Happy / Confident', score: 0.8, emoji: '\uD83D\uDE0A' };
  if (curiousCount > confusedCount && curiousCount > positiveCount)
    return { label: 'Curious / Inquisitive', score: 0.4, emoji: '\uD83E\uDD14' };
  return { label: 'Calm / Conversational', score: 0.0, emoji: '\uD83D\uDE10' };
}

const desktopClients = new Map();
const webClients = new Map();

nextApp.prepare().then(() => {
  const app = express();
  const server = http.createServer(app);

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
      if (pathname === '/api/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', geminiConfigured: !!process.env.GEMINI_API_KEY });
  });

  wss.on('connection', async (clientWs, request) => {
    const searchParams = new URL(request.url || '', 'http://localhost').searchParams;
    const clientType = searchParams.get('clientType') || 'web';
    const userId = searchParams.get('userId') || 'default-user';

    if (clientType === 'desktop') {
      desktopClients.set(userId, clientWs);
      console.log(`[WS] Desktop client connected for user: ${userId}`);
      
      // Notify web client
      let webWs = webClients.get(userId);
      if (!webWs && webClients.size > 0) {
        webWs = webClients.values().next().value;
      }
      if (webWs && webWs.readyState === 1) {
        webWs.send(JSON.stringify({ type: 'desktop_status', connected: true }));
      }
      
      clientWs.on('message', (buffer) => {
        try {
          const msg = JSON.parse(buffer.toString());
          if (msg.type === 'control' && msg.action === 'navigateToPage') {
            console.log(`[WS] Desktop controller requesting navigation to: ${msg.page}`);
            let webWs = webClients.get(userId);
            if (!webWs && webClients.size > 0) {
              // Fallback to first available web client in local setup
              webWs = webClients.values().next().value;
            }
            if (webWs && webWs.readyState === 1) {
              webWs.send(JSON.stringify({
                type: 'action',
                name: 'navigateToPage',
                args: { page: msg.page }
              }));
            }
          } else if (msg.type === 'chat_command') {
            console.log(`[WS] Relaying chat command from desktop for user ${userId}: ${msg.text}`);
            let webWs = webClients.get(userId);
            if (!webWs && webClients.size > 0) {
              webWs = webClients.values().next().value;
            }
            if (webWs && webWs.readyState === 1) {
              webWs.send(JSON.stringify({
                type: 'chat_command',
                text: msg.text
              }));
            }
          }
        } catch (e) {
          console.error('[WS] Desktop client message error:', e);
        }
      });

      clientWs.on('close', () => {
        desktopClients.delete(userId);
        console.log(`[WS] Desktop client disconnected for user: ${userId}`);
        let webWs = webClients.get(userId);
        if (!webWs && webClients.size > 0) {
          webWs = webClients.values().next().value;
        }
        if (webWs && webWs.readyState === 1) {
          webWs.send(JSON.stringify({ type: 'desktop_status', connected: false }));
        }
      });
      return;
    }

    // Register Web Client
    webClients.set(userId, clientWs);
    console.log(`[WS] Web client connected for user: ${userId}`);

    // Send initial desktop status
    const desktopConnected = desktopClients.has(userId) || (desktopClients.size > 0);
    clientWs.send(JSON.stringify({ type: 'desktop_status', connected: desktopConnected }));

    const language = searchParams.get('language') || 'all';
    const subject = searchParams.get('subject') || 'all';
    const age = searchParams.get('age') || '15+';

    let systemInstruction =
      'You are VEDIKA, a friendly, warm, encouraging, and highly intelligent female Socratic AI tutor and desktop companion. ' +
      'Always refer to yourself as VEDIKA. ' +
      'Your goal is to guide students and encourage their curiosity. ' +
      'Keep answers extremely conversational and concise (usually strictly 1 to 3 sentences maximum) so that it is easy and comfortable to listen to of the speech delivery. ' +
      'Do not output long formulas or dense blocks of texts. Break it down or offer to explain details when they ask. ' +
      `Your student is in the age group: ${age}. Adapt your explanations and style: ` +
      (age === '6-10' ? 'Speak in a highly playful, simple, enthusiastic cartoonish tone. Use game analogies and simple words. ' :
       age === '11-14' ? 'Speak clearly, using structured real-world analogies. ' :
       'Use rigorous Socratic guidance, deeper explanations, and pyodide/terminal coding references. ');


    if (language === 'telugu') systemInstruction += 'You must speak in Telugu only (unless referring to specific scientific/mathematical English terms). Frame your explanations sweetly in Telugu.';
    else if (language === 'hindi') systemInstruction += 'You must speak in Hindi. Use simple, easily understandable Hindi terms with a helpful academic tutoring style.';
    else if (language === 'english') systemInstruction += 'Please speak in clear, expressive English. Keep explanations simplified and kid-friendly.';
    else systemInstruction += 'You are multilingual. Support Telugu, Hindi, and English. Respond in the exact language the student speaks to you, or blend them naturally if they use a blend.';

    if (subject === 'math') systemInstruction += ' Currently helping with Mathematics! Help explain concepts like addition, fractions, algebra, or geometry using simple physical analogies.';
    else if (subject === 'science') systemInstruction += ' Currently helping with Science! Help explain concepts like gravity, photosynthesis, planets, or animals with fun, exciting facts.';
    else if (subject === 'languages') systemInstruction += ' Currently helping with Languages & Reading! Help expand vocabulary, teach correct grammar, or guide reading comprehensions with interesting sentences.';
    else systemInstruction += ' You are ready to tutor on any academic school subject: math, science, history, geography, languages, or reading.';

    systemInstruction += ' You can navigate the student to different pages (like the code-puzzle tab, playground/coding-tutor, courses list, progress dashboard, resources etc.) using the navigateToPage tool when they ask to open, navigate, start, or go to a page or workspace.';

    const sessionId = searchParams.get('sessionId');
    const memoryCtx = await loadMemoryContext(sessionId, userId);
    if (memoryCtx) systemInstruction += memoryCtx;

    let geminiSession = null;
    const failedKeys = new Set();
    let reconnectCount = 0;
    const MAX_RECONNECTS = 5;

    async function establishGeminiSession() {
      let success = false;
      let lastErr = null;

      while (!success) {
        const now = Date.now();
        const availableKeys = GEMINI_KEYS.filter(k => {
          if (failedKeys.has(k)) return false;
          const cooldownEnd = globalKeyCooldowns.get(k);
          if (cooldownEnd && now < cooldownEnd) return false;
          return true;
        });

        let keysToTry = availableKeys;
        if (keysToTry.length === 0) {
          // Fallback: ignore global cooldown if all are cooled down, but still exclude local connection failures
          keysToTry = GEMINI_KEYS.filter(k => !failedKeys.has(k));
        }

        if (keysToTry.length === 0) {
          throw new Error(lastErr ? `All API keys failed. Last error: ${lastErr.message}` : 'All configured Gemini API keys have failed.');
        }

        const apiKey = keysToTry[connectionCount % keysToTry.length];
        connectionCount++;
        console.log(`[WS] Connecting to Gemini Live with key index ${GEMINI_KEYS.indexOf(apiKey)}`);

        try {
          const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
          geminiSession = await ai.live.connect({
            model: 'gemini-3.1-flash-live-preview',
            callbacks: {
              onmessage: (message) => {
                const content = message.serverContent;
                
                // Handle Tool Calls
                const toolCall = message.toolCall || (content && content.toolCall);
                if (toolCall && toolCall.functionCalls) {
                  for (const call of toolCall.functionCalls) {
                    console.log(`[WS] Gemini requested tool call: ${call.name} with args:`, call.args);
                    clientWs.send(JSON.stringify({ 
                      type: 'action', 
                      name: call.name, 
                      args: call.args 
                    }));

                    // Forward tool call to the desktop companion client as well
                    let desktopWs = desktopClients.get(userId);
                    if (!desktopWs && desktopClients.size > 0) {
                      desktopWs = desktopClients.values().next().value;
                    }
                    if (desktopWs && desktopWs.readyState === 1) {
                      desktopWs.send(JSON.stringify({
                        type: 'action',
                        name: call.name,
                        args: call.args
                      }));
                    }

                    // Respond immediately back to the session
                    try {
                      geminiSession.send({
                        toolResponse: {
                          functionResponses: [
                            {
                              response: { output: { success: true } },
                              id: call.id
                            }
                          ]
                        }
                      });
                    } catch (e) {
                      console.error('[WS] Failed to send tool response:', e);
                    }
                  }
                }

                if (!content) return;
                for (const part of content.modelTurn?.parts || []) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ type: 'audio', data: part.inlineData.data }));
                  }
                }
                if (content.outputTranscription?.text) {
                  clientWs.send(JSON.stringify({ type: 'agent-transcription', text: content.outputTranscription.text }));
                }
                if (content.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }
                if (content.inputTranscription?.text?.trim()) {
                  const sentiment = analyzeSentiment(content.inputTranscription.text);
                  clientWs.send(JSON.stringify({ type: 'user-transcription', text: content.inputTranscription.text, sentiment }));
                }
              },
              onclose: () => {
                clientWs.send(JSON.stringify({ type: 'status', message: 'Tutor connection closed.' }));
              },
              onerror: async (error) => {
                console.error('[WS] Session error:', error);
                const errStr = String(error).toLowerCase();
                if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('limit') || errStr.includes('resource_exhausted') || errStr.includes('403') || errStr.includes('401')) {
                  console.warn('[WS] Rate limit or authorization hit. Attempting to rotate key and reconnect...');
                  failedKeys.add(apiKey);
                  markKeyFailed(apiKey);

                  reconnectCount++;
                  if (reconnectCount > MAX_RECONNECTS) {
                    console.error('[WS] Max reconnect attempts exceeded.');
                    clientWs.send(JSON.stringify({ type: 'error', message: 'Tutor session connection lost due to persistent rate limits.' }));
                    clientWs.close();
                    return;
                  }

                  try {
                    if (geminiSession) {
                      try { geminiSession.close(); } catch {}
                    }
                    clientWs.send(JSON.stringify({ type: 'status', message: 'Re-establishing connection with a different key...' }));
                    await establishGeminiSession();
                  } catch (reconnectErr) {
                    console.error('[WS] Failed to reconnect after key rotation:', reconnectErr);
                    clientWs.send(JSON.stringify({ type: 'error', message: `Tutor setup failed: ${reconnectErr.message}` }));
                    clientWs.close();
                  }
                } else {
                  clientWs.send(JSON.stringify({ type: 'error', message: 'Session error occurred.' }));
                }
              },
            },
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
              systemInstruction,
              outputAudioTranscription: {},
              inputAudioTranscription: {},
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: 'navigateToPage',
                      description: 'Navigate the student to a specific page or workspace in the LMS app.',
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          page: {
                            type: 'STRING',
                            description: 'The target page name, e.g. dashboard, courses, general-tutor, coding-tutor, progress, code-puzzle, quizzes, resources',
                            enum: ['dashboard', 'courses', 'general-tutor', 'coding-tutor', 'progress', 'code-puzzle', 'quizzes', 'resources']
                          }
                        },
                        required: ['page']
                      }
                    }
                  ]
                }
              ]
            },
          });
          success = true;
        } catch (err) {
          console.error(`[WS] Connection attempt failed with key index ${GEMINI_KEYS.indexOf(apiKey)}:`, err.message);
          failedKeys.add(apiKey);
          markKeyFailed(apiKey);
          lastErr = err;
        }
      }
    }

    try {
      clientWs.send(JSON.stringify({ type: 'status', message: 'Establishing low-latency connection to Gemini...' }));
      await establishGeminiSession();
      console.log('[WS] Connected with Gemini Live API');
      clientWs.send(JSON.stringify({ type: 'status', message: 'Tutor is ready! Ask your academic questions.' }));
    } catch (err) {
      console.error('[WS] Failed connecting to Gemini Live API:', err.message);
      clientWs.send(JSON.stringify({ type: 'error', message: `Tutoring setup failed: ${err.message}` }));
      clientWs.close();
      return;
    }

    clientWs.on('message', (buffer) => {
      try {
        const msg = JSON.parse(buffer.toString());
        if (msg.type === 'audio' && msg.data && geminiSession) {
          geminiSession.sendRealtimeInput({ audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } });
        } else if (msg.type === 'tab_change') {
          console.log(`[WS] Web client reports tab change to: ${msg.tab} for user ${userId}`);
          let desktopWs = desktopClients.get(userId);
          if (!desktopWs && desktopClients.size > 0) {
            desktopWs = desktopClients.values().next().value;
          }
          if (desktopWs && desktopWs.readyState === 1) {
            desktopWs.send(JSON.stringify({ type: 'tab_change', tab: msg.tab }));
          }
        } else if (msg.type === 'speech_response') {
          console.log(`[WS] Web client relays speech response to desktop for user ${userId}`);
          let desktopWs = desktopClients.get(userId);
          if (!desktopWs && desktopClients.size > 0) {
            desktopWs = desktopClients.values().next().value;
          }
          if (desktopWs && desktopWs.readyState === 1) {
            desktopWs.send(JSON.stringify({ type: 'speech_response', text: msg.text }));
          }
        }
      } catch (e) { console.error('[WS] Message handling error:', e); }
    });

    clientWs.on('close', () => {
      console.log(`[WS] Web client disconnected for user: ${userId}`);
      webClients.delete(userId);
      if (geminiSession) { try { geminiSession.close(); } catch {} }
    });
  });

  // Forward all other requests to Next.js
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT} (Next.js + WebSocket)`);
  });
});
