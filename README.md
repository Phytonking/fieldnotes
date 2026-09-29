# fieldnotes

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_nVaAoIwJOFXPpgrZM4fNuDPtSGO2)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Eve live assistant

The live assistant uses browser speech recognition for officer input, streams Eve's replies through a Next.js route backed by Vercel AI Gateway, and reads replies aloud with browser speech synthesis. Speech recognition support depends on the browser; Chrome currently provides the most complete experience.

1. Create an AI Gateway API key in your Vercel dashboard.
2. Copy `.env.example` to `.env.local` and set `AI_GATEWAY_API_KEY`.
3. Optionally set `AI_GATEWAY_MODEL` to a model slug enabled for your Gateway account. The default is `openai/gpt-5.5`.
4. Run `pnpm dev` and allow microphone access in the browser.

The API key stays on the server. On Vercel deployments, AI Gateway can also authenticate with `VERCEL_OIDC_TOKEN` when the project is configured for OIDC. Eve currently receives the chat conversation and case label/location; this prototype does not connect to a case database, public web search, dispatch, or other officer systems.

## Chat persistence

Chats, case labels, activity entries, transcripts, and the selected chat are saved in IndexedDB in the current browser. This survives reloads and browser restarts, but it is device- and browser-specific; it is not a shared or backed-up cloud database. Supabase is the recommended next step for multi-device/team use because Postgres fits the case-and-message data and Supabase also provides Auth and Storage. Before putting real case data in a hosted database, add user sign-in and row-level access policies. No Supabase project is configured in this workspace yet.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
