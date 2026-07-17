const globalKeyCooldowns = new Map(); // key -> cooldown end timestamp
const COOLDOWN_MS = 60000; // 60s cooldown

export function markKeyFailed(key) {
  if (key) {
    globalKeyCooldowns.set(key, Date.now() + COOLDOWN_MS);
  }
}

export function getRotatedKey(excludeKeys = []) {
  const keys = [];
  
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  
  for (let i = 1; ; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
    else break;
  }
  
  const now = Date.now();
  const availableKeys = keys.filter(k => {
    if (excludeKeys.includes(k)) return false;
    const cooldownEnd = globalKeyCooldowns.get(k);
    if (cooldownEnd && now < cooldownEnd) return false;
    return true;
  });

  // Fallback: If all keys are in cooldown, ignore cooldown (but still respect local request exclusions)
  if (availableKeys.length === 0) {
    const backupKeys = keys.filter(k => !excludeKeys.includes(k));
    if (backupKeys.length === 0) return null;
    return backupKeys[Math.floor(Math.random() * backupKeys.length)];
  }
  
  return availableKeys[Math.floor(Math.random() * availableKeys.length)];
}

