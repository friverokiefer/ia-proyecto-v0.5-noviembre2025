// backend/src/lib/ia-engine.client.ts
import {
  GenerateEmailResponseSchema,
  type ZodIAResponse,
} from "./ia-engine.schema";
import type { IaEngineFeedback, EmailSetLike } from "../services/iaEngine";
import { IA_ENGINE_BASE_URL } from "../services/iaEngine";

// Timeout helper
async function fetchWithTimeout(url: string, options: any, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err: any) {
    clearTimeout(id);
    throw new Error(`IA Engine error: ${err?.message || err}`);
  }
}

export interface GenerateEmailPayload {
  engine?: "anthropic" | "openai" | string;
  campaign: string;
  cluster: string;
  /** Cantidad de sets de contenido a generar (1..5). */
  sets: number;
  feedback?: IaEngineFeedback;
}

export interface GenerateEmailResponse {
  engine: string;
  variants: EmailSetLike[];
  metadata: Record<string, any>;
}

export class IAEngineClient {
  baseUrl: string;

  constructor(baseUrl = IA_ENGINE_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generateEmail(
    payload: GenerateEmailPayload,
    timeoutMs = 30000
  ): Promise<GenerateEmailResponse> {
    const url = `${this.baseUrl}/ia/generate`;

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `IA Engine responded ${res.status}: ${text || res.statusText}`
      );
    }

    const raw = (await res.json().catch((err) => {
      throw new Error(`Invalid JSON from IA engine: ${err}`);
    })) as unknown;

    const parsed = GenerateEmailResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `IA engine payload no cumple schema: ${parsed.error.message}`
      );
    }

    const data: ZodIAResponse = parsed.data;

    return {
      engine: data.engine,
      variants: data.variants as EmailSetLike[],
      metadata: data.metadata ?? {},
    };
  }
}
