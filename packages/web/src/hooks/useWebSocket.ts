import { useState, useEffect, useCallback, useRef } from 'react';
import type { WSMessage } from '@agent-chat-box/shared';

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
}

/** Get or create a stable client-side human ID */
function getOrCreateHumanId(): string {
  let id = localStorage.getItem('acb-humanId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('acb-humanId', id);
  }
  return id;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { url, onMessage, onConnect, onDisconnect, autoReconnect = true } = options;
  const [connected, setConnected] = useState(false);
  const [clientId] = useState<string | null>(() => getOrCreateHumanId());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeRef = useRef(true);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      // Suppress expected close errors during unmount / React StrictMode remount.
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    activeRef.current = true;

    // Avoid creating multiple concurrent sockets (e.g. React StrictMode double mount).
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!activeRef.current) {
        ws.close();
        return;
      }
      setConnected(true);
      onConnect?.();
    };

    ws.onmessage = (e) => {
      if (!activeRef.current) return;
      try {
        const msg: WSMessage = JSON.parse(e.data);
        // Note: clientId is now client-generated and stable (persisted in localStorage).
        // Server's system.welcome clientId is ignored for identity purposes.
        onMessage?.(msg);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (!activeRef.current) return;

      setConnected(false);
      onDisconnect?.();

      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    // Let onclose handle reconnection; logging here duplicates noise in StrictMode.
    ws.onerror = () => {};
  }, [url, onMessage, onConnect, onDisconnect, autoReconnect]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, clientId, send, disconnect, reconnect: connect };
}
