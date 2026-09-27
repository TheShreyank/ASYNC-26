# ASYNC 2026 | Junction Junkers

Junction Junkers is a voice-first habit tracker built for the ASYNC 2026 Wellness & Lifestyle track. It lets people define daily habits, record short reflections, and use Gemini to transcribe those reflections, identify completed habits, and summarize the day's progress.

## What It Does

- Start with sample daily habits or add your own.
- Record a spoken check-in and review it before sending it for transcription.
- Transcribe audio with Gemini, then compare the transcript with the day's habits.
- Review the transcript, habit status, and an AI-generated daily summary.

## Run Locally

Requirements: Node.js 20.9 or newer and a Gemini API key.

1. Open the app directory and install its dependencies:

	```bash
	cd frontend
	npm install
	```

2. Create `frontend/.env.local` and add your server-side key:

	```env
	GEMINI_API_KEY=your_gemini_api_key
	```

	If you already have `NEXT_PUBLIC_GEMINI_API_KEY` in that file, rename it to `GEMINI_API_KEY`. Restart the dev server after changing environment variables. Do not commit `.env.local` or expose the key with a `NEXT_PUBLIC_` prefix.

3. Start the development server:

	```bash
	npm run dev
	```

4. Visit `http://localhost:3000` and allow microphone access. Microphone recording requires localhost or an HTTPS deployment.

## Checks

Run these commands from `frontend/`:

```bash
npm run lint
npm run build
```

## Implementation

- Next.js App Router and React provide the interface and API routes.
- The browser records audio; `/api/transcribe` sends it to Gemini for transcription.
- `/api/analyze` receives the transcript and habit list, then returns completed habits and a daily summary.
- Gemini API calls run on the server. Audio and transcript data are sent to Google Gemini for processing.

## Prototype Notes

This is a hackathon prototype. Habits, transcripts, and summaries are held in browser memory and are lost when the page is refreshed. There are no accounts, database, or cross-day history yet. The initial habits are sample data, and AI-detected completion should be treated as a suggestion rather than a verified record. The Gemini API routes do not yet have user authentication or rate limiting, so add those controls before exposing a deployment broadly.

## Project Layout

```text
frontend/
  app/                 Dashboard, metadata, and API routes
  components/          Audio recorder and transcript upload UI
  public/              Static assets
```

See [frontend/README.md](frontend/README.md) for the app-specific entry point.
