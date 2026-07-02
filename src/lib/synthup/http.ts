import type { SpecOutline, StudioEvent } from "../types";
import type { SynthUpAdapter, SynthUpSessionConfig } from "./adapter";

export class HttpSynthUpAdapter implements SynthUpAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.SYNTHUP_API_URL ?? "";
    this.apiKey = process.env.SYNTHUP_API_KEY ?? "";
  }

  private headers(userEmail?: string): HeadersInit {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (userEmail) h["X-Loop-User"] = userEmail;
    return h;
  }

  async createSession(config: SynthUpSessionConfig): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/v1/sessions`, {
      method: "POST",
      headers: this.headers(config.userEmail),
      body: JSON.stringify({
        skill: config.skillId,
        workspace: config.workspace,
        user_email: config.userEmail,
        metadata: { studio_session_id: config.studioSessionId },
      }),
    });
    if (!res.ok) throw new Error(`SynthUp create session failed: ${res.status}`);
    return res.json();
  }

  async sendMessage(
    sessionId: string,
    content: string,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { ...this.headers(), Accept: "text/event-stream" },
      body: JSON.stringify({ content, role: "user" }),
    });
    if (!res.ok) throw new Error(`SynthUp message failed: ${res.status}`);
    await this.consumeSSE(res, onEvent);
  }

  async approveSpec(
    sessionId: string,
    spec: SpecOutline,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/approve`, {
      method: "POST",
      headers: { ...this.headers(), Accept: "text/event-stream" },
      body: JSON.stringify({ spec }),
    });
    if (!res.ok) throw new Error(`SynthUp approve failed: ${res.status}`);
    await this.consumeSSE(res, onEvent);
  }

  private async consumeSSE(
    res: Response,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6)) as StudioEvent;
            onEvent(event);
          } catch {
            // skip malformed
          }
        }
      }
    }
  }
}
