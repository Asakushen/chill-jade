import { app } from "./app";

type Env = Parameters<typeof app.fetch>[1] & { ASSETS: Fetcher };

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, executionContext);
    return env.ASSETS.fetch(request);
  },
};
