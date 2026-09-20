# Optional Anthropic / Claude setup

UFO can now run without `ANTHROPIC_API_KEY`.

- Claude is used when `ANTHROPIC_API_KEY` is configured.
- When it is absent, complex generation falls back to the existing OpenAI-compatible AI cascade (Groq -> Cerebras -> OpenRouter).
- The core app still requires Supabase and the configured fallback AI provider (`GROQ_API_KEY` is required by the current startup validation).
- Add the real Anthropic key later as `ANTHROPIC_API_KEY=...` to enable Claude for complex generation.

Never use a fake API key and never commit `.env.local` to Git.
