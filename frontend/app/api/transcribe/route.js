import { fetchWithRetry } from "@/lib/retry";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

async function saveTranscript(text) {
  if (supabase) {
    const { error } = await supabase.from("transcripts").insert({ transcript: text });
    if (error) console.error("Supabase error:", error);
  }
}

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Groq allows up to 25 MB

/**
 * Primary: Groq Whisper (whisper-large-v3-turbo)
 * Fallback: Gemini gemini-3.8-flash inline audio
 */
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

  const { audio, mimeType } = body;
  if (
    typeof audio !== "string" ||
    !audio ||
    typeof mimeType !== "string" ||
    !mimeType.startsWith("audio/")
  ) {
    return Response.json({ error: "A valid audio recording is required." }, { status: 400 });
  }

  if (audio.length > Math.ceil(MAX_AUDIO_BYTES * (4 / 3))) {
    return Response.json(
      { error: "The recording is too large. Record a shorter check-in." },
      { status: 413 }
    );
  }

  // --- Groq Whisper (primary) ---
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      // Decode base64 → raw Buffer
      const audioBuffer = Buffer.from(audio, "base64");
      const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";
      const filename = `audio.${ext}`;

      // Build multipart/form-data body manually.
      // Node.js FormData + File does NOT reliably stream Buffer bytes — this avoids that bug.
      const boundary = `----GroqBoundary${Date.now()}`;
      const CRLF = "\r\n";

      const partHeader = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
        `Content-Type: ${mimeType}${CRLF}${CRLF}`
      );
      const modelPart = Buffer.from(
        `${CRLF}--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
        `whisper-large-v3-turbo`
      );
      const formatPart = Buffer.from(
        `${CRLF}--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}` +
        `json`
      );
      const closing = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

      const bodyBuffer = Buffer.concat([partHeader, audioBuffer, modelPart, formatPart, closing]);

      const res = await fetchWithRetry(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": String(bodyBuffer.length),
          },
          body: bodyBuffer,
        },
        3
      );

      const data = await res.json();
      const transcript = data.text?.trim();
      if (!transcript) {
        return Response.json(
          { error: "No speech was detected in this recording." },
          { status: 422 }
        );
      }
      console.log("Groq transcription succeeded:", transcript.slice(0, 80));
      await saveTranscript(transcript);
      return Response.json({ transcript });
    } catch (err) {
      console.warn("Groq transcription failed, falling back to Gemini:", err.message);
      // Fall through to Gemini fallback
    }
  }


  // --- Gemini fallback ---
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json(
      { error: "No transcription service is configured on the server." },
      { status: 503 }
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4, expBase: 2, jitter: 0.2 },
      },
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: audio } },
            {
              text: "Transcribe this audio recording accurately into plain text. Do not add any conversational responses or introductory text.",
            },
          ],
        },
      ],
    });

    const transcript = response.text?.trim();
    if (!transcript) {
      return Response.json(
        { error: "No speech was detected in this recording." },
        { status: 422 }
      );
    }
    await saveTranscript(transcript);
    return Response.json({ transcript });
  } catch (error) {
    console.error("Gemini transcription fallback also failed:", error);
    let errorMessage = "Audio transcription failed. Please try again.";
    if (error?.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before recording again.";
    } else if (error?.message) {
      errorMessage = `Transcription error: ${error.message}`;
    }
    return Response.json({ error: errorMessage }, { status: error?.status || 502 });
  }
}