"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check } from "lucide-react";

const BARS = Array.from({ length: 22 }, (_, i) => i);

function formatTime(total) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function AudioRecorder({ onTranscriptReceived }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPreviewRef = useRef(null);

  useEffect(() => {
    if (!audioBlob || !audioPreviewRef.current) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const audioElement = audioPreviewRef.current;
    audioElement.src = audioUrl;

    return () => {
      URL.revokeObjectURL(audioUrl);
      audioElement.removeAttribute("src");
    };
  }, [audioBlob]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    let stream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recording = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(recording);
        recorder.stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setAudioBlob(null);
      setError("");
      setSeconds(0);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or not supported:", err);
      stream?.getTracks().forEach((track) => track.stop());
      setError("Allow microphone access to record a check-in.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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

    setLoading(true);
    setError("");

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: audioBlob.type.split(";")[0] || "audio/webm",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Transcription failed.");
      }

      const realTranscript = result.transcript?.trim();
      if (!realTranscript) throw new Error("No speech was detected in this recording.");
      setAudioBlob(null);
      if (onTranscriptReceived) {
        await onTranscriptReceived(realTranscript);
      }
    } catch (err) {
      console.error("Audio Transcription Error:", err);
      setError(err.message || "Transcription failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recorder" aria-live="polite">
      {isRecording ? (
        <>
          <div className="live">
            <span className="dot" aria-hidden="true" />
            <span className="timer">{formatTime(seconds)}</span>
            <div className="wave" aria-hidden="true">
              {BARS.map((i) => (
                <i key={i} style={{ "--i": i }} />
              ))}
            </div>
            <button type="button" onClick={stopRecording} className="btn btn-stop">
              <Square fill="currentColor" /> Stop
            </button>
          </div>
          <p className="hint">Listening. Tap stop when you&apos;re done.</p>
        </>
      ) : audioBlob ? (
        <>
          <div className="rec-row">
            <audio ref={audioPreviewRef} controls className="audio-preview" aria-label="Recording preview" />
          </div>
          <div className="rec-row" style={{ marginTop: 14 }}>
            <button type="button" onClick={handleUpload} disabled={loading} className="btn btn-hero">
              {loading ? (
                <>
                  <span className="spin" aria-hidden="true" /> Transcribing&hellip;
                </>
              ) : (
                <>
                  <Check strokeWidth={3} /> Save check-in
                </>
              )}
            </button>
            {!loading && (
              <button type="button" onClick={() => setAudioBlob(null)} className="btn btn-ghost">
                Record again
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="rec-row">
            <button type="button" onClick={startRecording} className="btn btn-hero btn-mic">
              <Mic /> Start check-in
            </button>
          </div>
          <p className="hint">Takes about a minute. Just say what you did today.</p>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}