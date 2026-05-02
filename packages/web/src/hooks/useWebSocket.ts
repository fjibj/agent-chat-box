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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      onConnect?.();
    };

    ws.onmessage = (e) => {
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
      setConnected(false);
      onDisconnect?.();
      wsRef.current = null;

      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    wsRef.current = ws;
  }, [url, onMessage, onConnect, onDisconnect, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

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
