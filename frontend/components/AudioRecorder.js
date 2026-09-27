"use client";

import { useState, useRef } from "react";
import { GoogleGenAI } from "@google/genai";

export default function AudioRecorder({ onTranscriptReceived }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or not supported:", err);
      alert("Microphone permission required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all track streams
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
  alert("API Key missing! Check .env.local");
  return;
}

    setLoading(true);

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: base64Audio,
                },
              },
              {
                text: "Transcribe this audio recording accurately into plain text. Do not add any conversational responses or intro text.",
              },
            ],
          },
        ],
      });

      const realTranscript = response.text ? response.text.trim() : "";
      setAudioBlob(null);
      if (onTranscriptReceived) {
        onTranscriptReceived(realTranscript);
      }
    } catch (err) {
      console.error("Audio Transcription Error:", err);
      alert(`Transcription Failed: ${err.message || "Invalid API key or network error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-slate-900 text-white border-slate-800">
      <div className="flex gap-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium animate-pulse"
          >
            Stop Recording
          </button>
        )}
      </div>

      {audioBlob && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <audio src={URL.createObjectURL(audioBlob)} controls className="h-10" />
          <button
            onClick={handleUpload}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white rounded-lg font-medium transition"
          >
            {loading ? "Transcribing Audio..." : "Transcribe & Save Log"}
          </button>
        </div>
      )}
    </div>
  );
}