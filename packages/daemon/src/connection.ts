import WebSocket from 'ws';
import type { WSMessage } from '@agent-chat-box/shared';
import { RECONNECT_DELAYS_MS, HEARTBEAT_INTERVAL_MS, API_KEY_PREFIX } from '@agent-chat-box/shared';

export interface ConnectionOptions {
  serverUrl: string;
  machineToken: string;
  onMessage?: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (err: Error) => void;
}

export class DaemonConnection {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private options: ConnectionOptions;

  constructor(options: ConnectionOptions) {
    this.options = options;
    if (!options.machineToken.startsWith(API_KEY_PREFIX)) {
      throw new Error(`Invalid machine token format. Must start with ${API_KEY_PREFIX}`);
    }
  }

  /** Connect to server */
  connect(): void {
    // Clear pending reconnect before closing old connection
    // (closing triggers 'close' handler which calls scheduleReconnect)
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners('close');
      this.ws.close();
      this.ws = null;
    }

    const url = `${this.options.serverUrl}/daemon/connect`;
    console.log(`[daemon] Connecting to ${url}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[daemon] Connected to server');
      this.connected = true;
      this.attempt = 0;
      this.authenticate();
      this.startPing();
      this.options.onConnect?.();
    });

    this.ws.on('message', (data) => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error('[daemon] Failed to parse message:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[daemon] Disconnected from server');
      this.connected = false;
      this.stopPing();
      this.options.onDisconnect?.();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[daemon] WebSocket error:', err.message);
      this.options.onError?.(err);
    });
  }

  /** Disconnect from server */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /** Send message to server */
  send(type: string, data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[daemon] Cannot send: not connected');
      return;
    }
    const msg: WSMessage = {
      v: 1,
      type,
      ts: Date.now(),
      data,
    };
    this.ws.send(JSON.stringify(msg));
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.connected;
  }

  private authenticate(): void {
    this.send('machine.auth', { machine_token: this.options.machineToken });
  }

  private handleMessage(msg: WSMessage): void {
    switch (msg.type) {
      case 'machine.welcome':
        console.log(
          `[daemon] Authenticated: ${(msg.data as { machineName?: string })?.machineName || 'unknown'}`,
        );
        // Delegate to user handler so daemon can register agent after auth
        this.options.onMessage?.(msg);
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'error':
        console.error(`[daemon] Server error: ${(msg.data as { message?: string })?.message}`);
        break;

      default:
        // Delegate to user handler
        this.options.onMessage?.(msg);
        break;
    }
  }

  private scheduleReconnect(): void {
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
    console.log(`[daemon] Reconnecting in ${delay}ms (attempt ${this.attempt + 1})`);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', {});
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
