/**
 * HTTP/SSE client for communicating with the Python backend.
 */
import * as http from "http";
import * as https from "https";
import { Settings } from "../config/Settings";
import { StreamCallbacks, StreamHandler } from "./StreamHandler";

export interface ChatRequest {
  message: string;
  context?: {
    file_path: string;
    file_content: string;
    selection?: { start: number; end: number };
    language: string;
  };
  workspace_path?: string;
  conversation_id?: string;
}

export interface CompleteRequest {
  file_path: string;
  content_before_cursor: string;
  content_after_cursor?: string;
  language?: string;
  max_tokens?: number;
}

export interface CompleteResponse {
  completion: string;
}

export interface IndexRequest {
  workspace_path: string;
  incremental?: boolean;
  changed_files?: string[];
}

export interface HealthResponse {
  status: string;
  model?: string;
}

export class BackendClient {
  private settings: Settings;
  private abortController: AbortController | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /**
   * Check backend health / connectivity.
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.request<HealthResponse>("GET", "/health");
    return response;
  }

  /**
   * Request a code completion (non-streaming).
   */
  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const body = {
      ...request,
      max_tokens: request.max_tokens ?? this.settings.completionMaxTokens,
    };
    return this.request<CompleteResponse>("POST", "/complete", body);
  }

  /**
   * Trigger codebase indexing.
   */
  async triggerIndex(request: IndexRequest): Promise<{ status: string }> {
    return this.request<{ status: string }>("POST", "/index", request);
  }

  /**
   * Send a chat message and stream the response via SSE.
   * Returns an abort function to cancel the stream.
   */
  chat(request: ChatRequest, callbacks: StreamCallbacks): () => void {
    // Cancel any existing stream
    this.abortStream();

    this.abortController = new AbortController();
    const handler = new StreamHandler(callbacks);

    const url = new URL("/stream", this.settings.backendUrl);
    const body = JSON.stringify({
      prompt: request.message,
      model: this.settings.modelAssignments.coder,
      temperature: 0.2,
    });

    const options = {
      method: "POST",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        callbacks.onError?.(
          new Error(`Backend returned status ${res.statusCode}`)
        );
        return;
      }

      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        handler.feed(chunk);
      });
      res.on("end", () => {
        handler.flush();
      });
      res.on("error", (err) => {
        callbacks.onError?.(err);
      });
    });

    req.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
        callbacks.onError?.(err);
      }
    });

    // Handle abort
    this.abortController.signal.addEventListener("abort", () => {
      req.destroy();
    });

    req.write(body);
    req.end();

    return () => this.abortStream();
  }

  /**
   * Abort the current streaming request.
   */
  abortStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Generic JSON request helper.
   */
  private request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.settings.backendUrl);
      const payload = body ? JSON.stringify(body) : undefined;

      const options: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(payload
            ? { "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
        timeout: 5000,
      };

      const transport = url.protocol === "https:" ? https : http;

      const req = transport.request(options, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `Backend error ${res.statusCode}: ${data}`
              )
            );
            return;
          }
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }
}
