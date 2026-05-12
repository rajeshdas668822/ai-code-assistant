/**
 * SSE stream handler — parses agent_start, token, done events from the backend.
 */

export interface StreamCallbacks {
  onAgentStart?: (agent: string) => void;
  onToken?: (content: string) => void;
  onDone?: (conversationId: string) => void;
  onError?: (error: Error) => void;
}

interface SSEEvent {
  event?: string;
  data: string;
}

/**
 * Parses a raw SSE text stream into structured events and invokes callbacks.
 */
export class StreamHandler {
  private callbacks: StreamCallbacks;
  private buffer: string = "";

  constructor(callbacks: StreamCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Feed raw SSE text chunks into the handler.
   * Call this as data arrives from the HTTP response.
   */
  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() ?? "";

    let currentEvent: string | undefined;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        this.handleEvent({ event: currentEvent, data });
        currentEvent = undefined;
      } else if (line.trim() === "") {
        // Empty line = end of event block, reset
        currentEvent = undefined;
      }
    }
  }

  /**
   * Signal that the stream has ended. Flushes any remaining buffer.
   */
  flush(): void {
    if (this.buffer.trim()) {
      if (this.buffer.startsWith("data:")) {
        const data = this.buffer.slice(5).trim();
        this.handleEvent({ data });
      }
      this.buffer = "";
    }
  }

  private handleEvent(event: SSEEvent): void {
    try {
      if (event.data === "[DONE]") {
        this.callbacks.onDone?.("");
        return;
      }

      const parsed = JSON.parse(event.data);

      switch (event.event) {
        case "agent_start":
          this.callbacks.onAgentStart?.(parsed.agent ?? "");
          break;
        case "token":
          this.callbacks.onToken?.(parsed.content ?? parsed.token ?? "");
          break;
        case "done":
          this.callbacks.onDone?.(parsed.conversation_id ?? "");
          break;
        default:
          // No event type — check for token field (legacy format)
          if (parsed.token !== undefined) {
            this.callbacks.onToken?.(parsed.token);
          } else if (parsed.error) {
            this.callbacks.onError?.(new Error(parsed.error));
          }
          break;
      }
    } catch {
      // Non-JSON data line — treat as raw token
      if (event.data && event.data !== "[DONE]") {
        this.callbacks.onToken?.(event.data);
      }
    }
  }
}
