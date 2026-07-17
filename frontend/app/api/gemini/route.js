import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, makeCacheKey } from '@/lib/cache';
import { getRotatedKey, markKeyFailed } from '@/lib/keys';
import { loadHistory, saveHistory, recall, buildMemoryContext, trackApiConsumption } from '@/lib/memory';

function calculateWait(error, baseDelay, attempt) {
  if (error?.details) {
    for (const d of error.details) {
      if (d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && d.retryDelay) {
        const m = d.retryDelay.match(/([\d.]+)(s|ms)/);
        if (m) return parseFloat(m[1]) * (m[2] === 'ms' ? 1 : 1000) + 200;
      }
    }
  }
  if (error?.message) {
    const m = error.message.match(/Please retry in ([\d.]+)(m?s)/i);
    if (m) return parseFloat(m[1]) * (m[2].toLowerCase() === 'ms' ? 1 : 1000) + 200;
  }
  return baseDelay * Math.pow(2, attempt);
}

export async function POST(request) {
  const { system, user, maxOutputTokens, sessionId, userId } = await request.json();
  if (!user) {
    return NextResponse.json({ error: 'User message is required.' }, { status: 400 });
  }

  // Load memory context
  console.warn(`[Gemini] sessionId=${sessionId} userId=${userId}`);
  const [history, memories] = await Promise.all([
    loadHistory(sessionId),
    recall(userId),
  ]);
  const memoryCtx = buildMemoryContext(history, memories);
  const fullSystem = system ? system + memoryCtx : memoryCtx;
  console.warn(`[Gemini] history=${history?.length} memories=${memories?.length} ctxLen=${memoryCtx.length}`);

  const cacheKey = makeCacheKey('generate', fullSystem, user, maxOutputTokens);
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ text: cached });

  const historyContents = (history || []).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const failedKeys = [];
  const retries = 5;
  const baseDelay = 1000;
  let lastError = null;

  for (let i = 0; i < retries; i++) {
    const activeKey = getRotatedKey(failedKeys);
    if (!activeKey) {
      console.error('[Gemini API] No available keys configured or all keys failed.');
      break;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...historyContents,
              { role: 'user', parts: [{ text: user }] },
            ],
            ...(fullSystem ? { systemInstruction: { parts: [{ text: fullSystem }] } } : {}),
            generationConfig: { temperature: 0.4, maxOutputTokens: maxOutputTokens || 8192 },
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        if (data.error.code === 429 || data.error.code === 503) {
          failedKeys.push(activeKey);
          markKeyFailed(activeKey);
          const ms = calculateWait(data.error, baseDelay, i);
          console.warn(`[Backend] Key failed with ${data.error.code}. Retrying in ${Math.round(ms)}ms with a new key (${i + 1}/${retries})`);
          await new Promise(r => setTimeout(r, ms));
          lastError = data.error.message;
          continue;
        }
        return NextResponse.json({ error: data.error.message }, { status: response.status || 500 });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) cacheSet(cacheKey, text);

      // Save working memory asynchronously
      if (sessionId && text) {
        const updated = [
          ...(history || []),
          { role: 'user', content: user },
          { role: 'assistant', content: text },
        ];
        saveHistory(sessionId, updated);
        trackApiConsumption(userId, user, text);
      }

      return NextResponse.json({ text });
    } catch (error) {
      failedKeys.push(activeKey);
      markKeyFailed(activeKey);
      if (i === retries - 1) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
      }
      const ms = baseDelay * Math.pow(2, i);
      console.warn(`[Backend] Network error. Retrying in ${ms}ms with a new key (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, ms));
      lastError = error.message;
    }
  }

  return NextResponse.json({ error: lastError || 'All configured Gemini API keys failed or rate-limited.' }, { status: 500 });
}
