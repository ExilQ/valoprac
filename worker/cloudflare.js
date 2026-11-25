// Cloudflare Workers entry (12.22): serves the static Vite build through the
// ASSETS binding. The ChatGPT Sites deployment keeps its own worker.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
