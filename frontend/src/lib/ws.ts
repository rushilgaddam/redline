import { useEffect, useRef } from "react";
import type { Flag } from "./types";

export type WsEvent =
  | { event: "flag_created"; payload: Flag }
  | { event: "flag_updated"; payload: Flag };

export function useInboxSocket(onEvent: (evt: WsEvent) => void, onStatusChange?: (connected: boolean) => void) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws/inbox`);
      ws.onopen = () => statusRef.current?.(true);
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as WsEvent;
          cbRef.current(parsed);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        statusRef.current?.(false);
        if (!closedByUs) retryTimer = setTimeout(connect, 1500);
      };
    }
    connect();

    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);
}
