import { fetchWithRetry } from "@/lib/retry";

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

  const { habits, logs } = body;
  if (
    !Array.isArray(habits) ||
    !habits.length ||
    !habits.every((h) => typeof h === "string" && h.trim()) ||
    !Array.isArray(logs) ||
    !logs.length ||
    !logs.every((l) => typeof l === "string" && l.trim())
  ) {
    return Response.json(
      { error: "At least one habit and one transcript are required." },
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
    'You are a thoughtful daily habit reflection assistant. ' +
    'Return ONLY valid JSON matching this exact structure:\n' +
    '{\n' +
    '  "completedHabits": ["Wake up at 6 a.m.", "Go to the gym"],\n' +
    '  "partialHabits": [{"name": "Read 20 pages", "message": "You read 5 pages, only 15 more to go! You got this!"}],\n' +
    '  "cumulativeSummary": "Great start to your day!"\n' +
    '}\n' +
    'RULES:\n' +
    '1. "completedHabits": Exact names from the target list for completed/exceeded habits. For time habits, allow a 15-min buffer. For quantity habits, allow a small realistic buffer.\n' +
    '2. "partialHabits": CRITICAL: If the user describes making PARTIAL progress on a quantitative habit (e.g. 5 pages out of 20), YOU MUST include it here. The "message" must be a highly motivational push notification.\n' +
    '3. YOU MUST INCLUDE "partialHabits" IN YOUR OUTPUT EVEN IF EMPTY [].';

  const userMessage =
    `Target daily habits: ${JSON.stringify(habits)}\n\n` +
    `Audio transcripts recorded today:\n` +
    logs.map((log, i) => `${i + 1}. ${JSON.stringify(log)}`).join("\n") +
    `\n\nIdentify completed habits, identify any partial progress for notifications, and write a concise, encouraging summary of the day's reported progress.`;

  // Try each model in order — if one is rate-limited, fall to the next
  for (const model of MODELS) {
    try {
      console.log(`[analyze] Trying model: ${model}`);
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
            temperature: 0.3,
            max_tokens: 1024,
          }),
        },
        2 // 2 retry attempts per model
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

      if (!Array.isArray(result.completedHabits) || typeof result.cumulativeSummary !== "string") {
        throw new Error(`Unexpected shape from Groq: ${JSON.stringify(result).slice(0, 120)}`);
      }

      const completedSet = new Set(result.completedHabits);
      const completedHabits = [...new Set(habits.filter((h) => completedSet.has(h)))];
      console.log(`[analyze] Success with ${model}. Completed: ${completedHabits.length}/${habits.length}`);

      // Server-side partial progress detection (AI models won't reliably do this)
      const partialHabits = [];
      const incompleteHabits = habits.filter((h) => !completedSet.has(h));
      const allTranscriptText = logs.join(" ").toLowerCase();

      for (const habit of incompleteHabits) {
        const keywords = habit.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !["the", "and", "for", "about", "with"].includes(w));
        const mentionedKeywords = keywords.filter(kw => allTranscriptText.includes(kw));

        if (mentionedKeywords.length >= Math.max(1, Math.ceil(keywords.length * 0.4))) {
          // Parse quantity from habit string (e.g. "10k", "20")
          const parseQuantity = (str) => {
            const match = str.match(/(\d[\d,.]*)\s*(k)?/i);
            if (!match) return null;
            let num = parseFloat(match[1].replace(/,/g, ''));
            if (match[2] && match[2].toLowerCase() === 'k') num *= 1000;
            return num;
          };

          const targetQty = parseQuantity(habit);
          let currentQty = null;

          // Find the maximum number mentioned in the transcripts
          const transcriptNumbers = [...allTranscriptText.matchAll(/(\d[\d,.]*)\s*(k)?/gi)].map(m => {
            let num = parseFloat(m[1].replace(/,/g, ''));
            if (m[2] && m[2].toLowerCase() === 'k') num *= 1000;
            return num;
          });

          if (transcriptNumbers.length > 0) {
             currentQty = Math.max(...transcriptNumbers);
          }

          if (targetQty && currentQty && currentQty < targetQty && currentQty > 0) {
            const remaining = targetQty - currentQty;
            const isClose = (currentQty / targetQty) >= 0.5;
            
            partialHabits.push({
              name: habit,
              message: isClose 
                ? `You're so close! Only ${remaining} left to complete "${habit}". You can do it! 💪`
                : `Good start! You have ${remaining} left to hit your goal for "${habit}". Keep it up!`
            });
          } else if (transcriptNumbers.length > 0) {
            partialHabits.push({
              name: habit,
              message: `You've made progress on "${habit}" — keep pushing to finish it today! 💪`
            });
          }
        }
      }

      console.log(`[analyze] Partial habits detected: ${partialHabits.length}`);
      return Response.json({ completedHabits, partialHabits, cumulativeSummary: result.cumulativeSummary });

    } catch (err) {
      console.warn(`[analyze] ${model} failed (status: ${err?.status}):`, err.message);
      // If it's a 429, try the next (faster/smaller) model
      // If it's anything else, bail immediately
      if (err?.status !== 429 && err?.status !== 503) {
        return Response.json(
          { error: `Analysis error: ${err.message}` },
          { status: err?.status || 502 }
        );
      }
    }
  }

  // All models exhausted
  return Response.json(
    { error: "All Groq models are currently rate-limited. Please wait a moment and try again." },
    { status: 429 }
  );
}