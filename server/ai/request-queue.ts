/**
 * 请求队列 — 并发控制 + 优先级调度 + 429 自动重试
 */

interface QueueItem<T> {
  readonly execute: () => Promise<T>;
  readonly priority: number;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const DEFAULT_MAX_CONCURRENT = 6;
const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 3;

export class RequestQueue {
  private readonly maxConcurrent: number;
  private running = 0;
  private readonly pending: QueueItem<unknown>[] = [];

  constructor(maxConcurrent: number = DEFAULT_MAX_CONCURRENT) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue<T>(execute: () => Promise<T>, priority: number = 10): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = { execute, priority, resolve, reject };
      this.pending.push(item as QueueItem<unknown>);
      this.pending.sort((a, b) => a.priority - b.priority);
      this.tryNext();
    });
  }

  private tryNext(): void {
    if (this.running >= this.maxConcurrent || this.pending.length === 0) {
      return;
    }

    const item = this.pending.shift()!;
    this.running++;

    item
      .execute()
      .then((result) => item.resolve(result))
      .catch((err) => item.reject(err))
      .finally(() => {
        this.running--;
        this.tryNext();
      });
  }

  get stats(): { running: number; pending: number; maxConcurrent: number } {
    return {
      running: this.running,
      pending: this.pending.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("429") || msg.includes("too many");
  }
  return false;
}

export function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
): () => Promise<T> {
  return async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        if (isRateLimitError(err) && attempt < maxRetries) {
          const delay = RETRY_DELAY_MS * (attempt + 1);
          process.stderr.write(
            `[wxai] rate limit，${delay / 1000}s 后重试 (${attempt + 1}/${maxRetries})\n`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };
}

// 优先级常量
export const PRIORITY_CHAT = 1;
export const PRIORITY_SESSION = 2;
export const PRIORITY_SUMMARY = 5;
export const PRIORITY_TASK = 10;

const maxConcurrent = parseInt(
  process.env["WXAI_MAX_CONCURRENT"] ?? String(DEFAULT_MAX_CONCURRENT),
  10,
);

export const globalQueue = new RequestQueue(maxConcurrent);
