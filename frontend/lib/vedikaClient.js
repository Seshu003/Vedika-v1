/**
 * vedikaClient.js
 * ================
 * Client for connecting the Next.js LMS to the local desktop mascot companion.
 */

export class VedikaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:7000';
    this.userId = null;
  }

  setUser(email) {
    this.userId = email;
    return this;
  }

  async isRunning() {
    try {
      const res = await fetch(`${this.baseUrl}/api/status`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async sendActivity(action, route, context = {}) {
    const payload = {
      action,
      userId: this.userId || undefined,
      currentRoute: route,
      timestamp: Date.now() / 1000,
      contextData: context,
    };
    return this._post('/api/activity', payload);
  }

  async sendChat(message, route = '/') {
    const payload = {
      action: 'chat_message',
      userId: this.userId || undefined,
      currentRoute: route,
      timestamp: Date.now() / 1000,
      contextData: { chatMessageText: message },
    };
    return this._post('/api/chat', payload);
  }

  async onboard(name, age) {
    return this._post('/api/onboard', {
      userId: this.userId || undefined,
      name,
      age,
    });
  }

  async _post(path, body) {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      // Companion not running, fail silently
      return null;
    }
  }
}

export const vedika = new VedikaClient();
