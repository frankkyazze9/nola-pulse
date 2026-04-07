import { PubSub } from "@google-cloud/pubsub";
import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";
import { Firestore } from "@google-cloud/firestore";
import Anthropic from "@anthropic-ai/sdk";

const PROJECT_ID = "nola-ai-innovation";
const KB_DATASET = "nola_pulse_kb";
const KB_BUCKET = "nola-pulse-kb";
const FIRESTORE_DB = "agents";

export interface AgentConfig {
  name: string;
  version: string;
  type: "scout" | "analyst" | "creator" | "publisher";
}

export interface Insight {
  id: string;
  type: "pattern" | "anomaly" | "trend" | "comparison" | "story";
  headline: string;
  summary: string;
  dataPoints: { label: string; value: string; source: string }[];
  relevance: number;
  topics: string[];
  suggestedFormats: string[];
  createdAt: string;
}

export interface ContentDraft {
  id: string;
  type: "article" | "infographic" | "white_paper" | "tweet";
  title: string;
  body: string;
  insightId: string | null;
  createdBy: string;
  status: "draft" | "pending_review" | "approved" | "published" | "rejected";
  createdAt: string;
}

export class Agent {
  readonly name: string;
  readonly version: string;
  readonly type: string;

  private pubsub: PubSub;
  private bigquery: BigQuery;
  private storage: Storage;
  private firestore: Firestore;
  private claude: Anthropic;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.version = config.version;
    this.type = config.type;

    this.pubsub = new PubSub({ projectId: PROJECT_ID });
    this.bigquery = new BigQuery({ projectId: PROJECT_ID });
    this.storage = new Storage({ projectId: PROJECT_ID });
    this.firestore = new Firestore({ projectId: PROJECT_ID, databaseId: FIRESTORE_DB });
    this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  // --- Pub/Sub ---

  async publish(topic: string, data: Record<string, unknown>): Promise<void> {
    const fullTopic = `nola-pulse.${topic}`;
    const message = JSON.stringify({
      ...data,
      _agent: this.name,
      _timestamp: new Date().toISOString(),
    });
    await this.pubsub.topic(fullTopic).publishMessage({ data: Buffer.from(message) });
  }

  // --- Knowledge Base: BigQuery ---

  async queryKB(sql: string): Promise<Record<string, unknown>[]> {
    const [rows] = await this.bigquery.query({ query: sql });
    return rows;
  }

  async insertKB(table: string, rows: object[]): Promise<void> {
    const dataset = this.bigquery.dataset(KB_DATASET);
    try {
      await dataset.table(table).insert(rows, {
        ignoreUnknownValues: true,
        skipInvalidRows: true,
      });
    } catch (err: any) {
      if (err.name === "PartialFailureError" && err.errors) {
        const sampleError = err.errors[0]?.errors?.[0];
        console.warn(
          `[${this.name}] BigQuery partial insert failure on ${table}: ${err.errors.length} rows failed. Sample: ${JSON.stringify(sampleError)}`
        );
        // Don't rethrow — partial success is better than total failure
      } else {
        throw err;
      }
    }
  }

  // --- Knowledge Base: Cloud Storage ---

  async storeDocument(path: string, content: string | Buffer): Promise<string> {
    const bucket = this.storage.bucket(KB_BUCKET);
    const file = bucket.file(path);
    await file.save(content);
    return `gs://${KB_BUCKET}/${path}`;
  }

  async readDocument(path: string): Promise<string> {
    const bucket = this.storage.bucket(KB_BUCKET);
    const [content] = await bucket.file(path).download();
    return content.toString();
  }

  // --- Agent State: Firestore ---

  async reportStatus(status: "running" | "idle" | "error", details?: string): Promise<void> {
    try {
      await this.firestore.doc(`agents/${this.name}`).set(
        {
          status,
          details: details || null,
          lastRun: new Date().toISOString(),
          version: this.version,
          type: this.type,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn(`[${this.name}] Firestore status update failed (non-fatal):`, (err as Error).message);
    }

    try {
      await this.publish("agent.status", { agent: this.name, status, details });
    } catch (err) {
      console.warn(`[${this.name}] Pub/Sub status publish failed (non-fatal):`, (err as Error).message);
    }
  }

  async submitDraft(draft: Omit<ContentDraft, "id" | "createdAt" | "createdBy" | "status">): Promise<string> {
    const doc = this.firestore.collection("content-queue").doc();
    const fullDraft: ContentDraft = {
      ...draft,
      id: doc.id,
      createdBy: this.name,
      status: "pending_review",
      createdAt: new Date().toISOString(),
    };
    await doc.set(fullDraft);
    await this.publish("content.drafted", { contentId: doc.id, type: draft.type });
    return doc.id;
  }

  async submitInsight(insight: Omit<Insight, "id" | "createdAt">): Promise<string> {
    const id = `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const full: Insight = {
      ...insight,
      id,
      createdAt: new Date().toISOString(),
    };

    // Store in BigQuery for long-term analytics
    await this.insertKB("insights", [
      {
        id: full.id,
        type: full.type,
        headline: full.headline,
        summary: full.summary,
        data_points: JSON.stringify(full.dataPoints),
        relevance: full.relevance,
        topics: full.topics.join(","),
        suggested_formats: full.suggestedFormats.join(","),
        created_by: this.name,
        created_at: full.createdAt,
      },
    ]);

    // Store in Firestore for real-time access
    await this.firestore.doc(`insights/${id}`).set(full);

    await this.publish("insight.created", { insightId: id, type: insight.type, relevance: insight.relevance });
    return id;
  }

  // --- Claude API ---

  async think(systemPrompt: string, userPrompt: string, options?: { model?: string; maxTokens?: number }): Promise<string> {
    const message = await this.claude.messages.create({
      model: options?.model || "claude-sonnet-4-20250514",
      max_tokens: options?.maxTokens || 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    return content.text;
  }

  // --- Lifecycle ---

  async run(work: () => Promise<void>): Promise<void> {
    try {
      await this.reportStatus("running");
      await work();
      await this.reportStatus("idle", "Completed successfully");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.reportStatus("error", msg);
      throw error;
    }
  }
}
