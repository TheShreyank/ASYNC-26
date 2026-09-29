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
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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
    return Response.json({ error: "Audio transcription failed. Please try again." }, { status: 502 });
  }
}