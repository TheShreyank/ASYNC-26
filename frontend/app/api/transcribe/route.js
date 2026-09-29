import { GoogleGenAI } from "@google/genai";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

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

  if (audio.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3)) {
    return Response.json({ error: "The recording is too large. Record a shorter check-in." }, { status: 413 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Gemini is not configured on the server." }, { status: 503 });
  }

  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        retryOptions: {
          attempts: 7,
          initialDelay: 0.5,
          maxDelay: 2,
          expBase: 2,
          jitter: 0.2,
        },
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
      return Response.json({ error: "No speech was detected in this recording." }, { status: 422 });
    }

    return Response.json({ transcript });
  } catch (error) {
    console.error("Audio transcription failed:", error);
    
    // Check if it's a rate limit or a specific API error
    let errorMessage = "Audio transcription failed. Please try again.";
    if (error?.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment before recording again.";
    } else if (error?.message) {
      // Pass through the API error message if available, so it's clear what went wrong
      errorMessage = `Transcription error: ${error.message}`;
    }
    
    return Response.json({ error: errorMessage }, { status: error?.status || 502 });
  }
}