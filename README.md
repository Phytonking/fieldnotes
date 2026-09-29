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

Scout uses OpenAI GPT-Live 1 through Vercel AI Gateway for full-duplex microphone input and spoken replies. The browser receives a short-lived, single-use Gateway token; the long-lived API key remains on the server. GPT-Live sessions are billed by active session duration (currently about $0.05/minute at the provider list price).

1. Create an AI Gateway API key in your Vercel dashboard.
2. Copy `.env.example` to `.env.local` and set `AI_GATEWAY_API_KEY`.
3. Optionally set `AI_GATEWAY_MODEL` for the Eve text agent used for background tool work. The live voice model is `openai/gpt-live-1`.
4. Run `pnpm dev` and allow microphone access in the browser.

The system prompt lives in `agent/instructions.md`. GPT-Live searches the connected Neon case-chat memory while the officer speaks. Neon contains prior Scout and officer messages for the selected case; no address-level incident feed, dispatch, evidence, pawn, or body-camera system is connected in this workspace. The Eve runtime and its `search_case_memory` tool remain available for agent-mediated work.

## Chat storage and retrieval

The browser keeps a local IndexedDB copy so chats survive reloads. To enable a shared, searchable Neon database, create a Neon Postgres database with `pgvector`, run `db/migrations/001_chat_memory.sql` in its SQL editor, and set `DATABASE_URL` in `.env.local` from `.env.example`. Keep that connection string server-side; the browser never connects to Postgres directly.

When `DATABASE_URL` is set, completed chat turns are saved in `chat_threads` and `chat_messages`. Live lookups use Postgres full-text search within the selected case and include the saved timestamp. Eve's `search_case_memory` tool can also use semantic retrieval with `pgvector`; when Gateway embedding access is unavailable it falls back to full-text search. Search results are historical context, not verified facts. Without `DATABASE_URL`, the app continues using browser-only storage and Scout has no server-side chat memory.

The workspace does not yet provide officer sign-in or case-assignment claims. For that reason, Neon sync and browser access to the Eve agent fail closed in production until authentication and case-level authorization are configured. Local development uses Eve's local development identity.

Neon stores the chat history and optional vectors in one Postgres database. Keep the deployment private until real officer sign-in and case-level access controls are configured.
