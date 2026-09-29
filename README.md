# On Scene

On Scene is a voice-first field assistant for live conversations, case context, and activity logs. The responsive workspace includes light and dark themes, a chat rail, voice transcripts, and case activity history.

## Getting started

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and allow microphone access to start a live voice session.

## Scout live assistant

Scout uses browser speech recognition for officer input, streams replies through a Vercel Eve agent hosted with the Next.js app, and reads replies aloud with browser speech synthesis. Speech recognition support depends on the browser; Chrome currently provides the most complete experience.

1. Create an AI Gateway API key in your Vercel dashboard.
2. Copy `.env.example` to `.env.local` and set `AI_GATEWAY_API_KEY`.
3. Optionally set `AI_GATEWAY_MODEL` to a model slug enabled for your Gateway account. The default is `openai/gpt-5.5`.
4. Run `pnpm dev` and allow microphone access in the browser.

The API key stays on the server. On Vercel deployments, AI Gateway can also authenticate with `VERCEL_OIDC_TOKEN` when the project is configured for OIDC. Eve keeps a durable session for each active chat and can search prior Scout and officer messages in the selected case. It does not connect to official case records, dispatch, or other officer systems.

## Chat storage and retrieval

The browser keeps a local IndexedDB copy so chats survive reloads. To enable a shared, searchable Neon database, create a Neon Postgres database with `pgvector`, run `db/migrations/001_chat_memory.sql` in its SQL editor, and set `DATABASE_URL` in `.env.local` from `.env.example`. Keep that connection string server-side; the browser never connects to Postgres directly.

When `DATABASE_URL` is set, completed chat turns are saved in `chat_threads` and `chat_messages`. Eve's `search_case_memory` tool searches only the selected case, using Postgres full-text search and attempting semantic retrieval with `pgvector` and Vercel AI Gateway embeddings (`openai/text-embedding-3-small`). If the Gateway account cannot access that embedding model, Scout falls back to full-text search. The current free-tier Gateway credential returned an access error for the embedding model during verification, while Neon writes and full-text retrieval worked. Search results are historical context, not verified facts. Without `DATABASE_URL`, the app continues using browser-only storage and Scout has no server-side chat memory.

The workspace does not yet provide officer sign-in or case-assignment claims. For that reason, Neon sync and browser access to the Eve agent fail closed in production until authentication and case-level authorization are configured. Local development uses Eve's local development identity.

Neon stores the chat history and optional vectors in one Postgres database. Keep the deployment private until real officer sign-in and case-level access controls are configured.
