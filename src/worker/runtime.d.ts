interface D1Result<T = unknown> { results: T[]; success?: boolean }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
interface Fetcher { fetch(request: Request): Promise<Response> }
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; props: Record<string, unknown> }
