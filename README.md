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

Scout uses browser speech recognition for officer input, streams replies through a Next.js route backed by Vercel AI Gateway, and reads replies aloud with browser speech synthesis. Speech recognition support depends on the browser; Chrome currently provides the most complete experience.

1. Create an AI Gateway API key in your Vercel dashboard.
2. Copy `.env.example` to `.env.local` and set `AI_GATEWAY_API_KEY`.
3. Optionally set `AI_GATEWAY_MODEL` to a model slug enabled for your Gateway account. The default is `openai/gpt-5.5`.
4. Run `pnpm dev` and allow microphone access in the browser.

The API key stays on the server. On Vercel deployments, AI Gateway can also authenticate with `VERCEL_OIDC_TOKEN` when the project is configured for OIDC. Scout currently receives the conversation and case label/location; this prototype does not connect to a case database, dispatch, or other officer systems.

## Chat storage

Chats, case labels, activity entries, transcripts, and the selected chat are saved in IndexedDB in the current browser. This survives reloads and browser restarts, but it is device- and browser-specific; it is not a shared or backed-up cloud database. Add user sign-in and access policies before storing real case data in a hosted database.
