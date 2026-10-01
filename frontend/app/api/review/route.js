import { fetchWithRetry } from "@/lib/retry";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { logs, habits = [] } = body;
  if (!Array.isArray(logs) || !logs.length) {
    return Response.json(
      { error: "At least one transcript is required for a review." },
      { status: 400 }
    );
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return Response.json(
      { error: "Groq API key is not configured on the server." },
      { status: 503 }
    );
  }

  const systemPrompt =
    'You are a highly motivating, thoughtful, and insightful daily reflection assistant. ' +
    'Return ONLY valid JSON with this exact shape: {"dailyReview": string}. ' +
    'Keep the review concise but detailed enough to be meaningful (max 80 words, 4-5 sentences). Focus on celebrating their wins to keep them motivated! ' +
    'Do NOT just list out everything that happened. ' +
    'Crucially, analyze the user\'s completed vs incomplete habits alongside the timeline of their check-ins. ' +
    'Kindly but directly point out exactly where they missed out and where they had gaps in their schedule to knock out missed tasks. ' +
    'End on an encouraging and uplifting note. Write as a single, highly engaging paragraph.';

  const userMessage =
    `Target habits for today:\n${JSON.stringify(habits)}\n\n` +
    `Check-in transcripts (with timestamps):\n` +
    logs.map((log, i) => `${i + 1}. ${JSON.stringify(log)}`).join("\n");

  for (const model of MODELS) {
    try {
      console.log(`[review] Trying model: ${model}`);
      const res = await fetchWithRetry(
        GROQ_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.4,
            max_tokens: 1024,
          }),
        },
        2
      );

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Empty response from Groq.");

      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        throw new Error(`Groq returned non-JSON: ${raw.slice(0, 120)}`);
      }

      if (typeof result.dailyReview !== "string") {
        throw new Error(`Unexpected shape from Groq: ${JSON.stringify(result).slice(0, 120)}`);
      }

      console.log(`[review] Success with ${model}.`);

      if (supabase) {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || "demo_user_123";
        
        const completedHabits = habits.filter(h => h.completed).map(h => h.name);
        const { error } = await supabase.from("daily_overviews").upsert({
          user_id: userId,
          date: new Date().toISOString().split("T")[0],
          summary: result.dailyReview,
          completed_habits: completedHabits
        }, { onConflict: "user_id, date" });
        
        if (error) console.error("Supabase upsert error:", error);
      }

      return Response.json({ dailyReview: result.dailyReview });

    } catch (err) {
      console.warn(`[review] ${model} failed (status: ${err?.status}):`, err.message);
      if (err?.status !== 429 && err?.status !== 503) {
        return Response.json(
          { error: `Review error: ${err.message}` },
          { status: err?.status || 502 }
        );
      }
    }
  }

  return Response.json(
    { error: "All Groq models are currently rate-limited. Please wait a moment and try again." },
    { status: 429 }
  );
}
