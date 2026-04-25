/**
 * Audio recording and TTS playback helpers for the visitor app.
 *
 * Recording: prefers audio/webm (Chrome/Android) and falls back to audio/mp4
 * (iOS Safari, which doesn't support webm). The chosen mime type is what the
 * backend's transcribe endpoint receives, so it must match its allowlist.
 *
 * Playback: full-buffer playback (await blob, then play). Streaming playback
 * via MediaSource is a v2 refinement.
 */

const VISITOR_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const PREFERRED_RECORDER_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickRecorderMime(): string {
  for (const mime of PREFERRED_RECORDER_MIMES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "audio/webm"; // last-ditch — iOS will throw and the caller surfaces it
}

export interface Recorder {
  stop(): Promise<{ blob: Blob; mimeType: string }>;
  cancel(): void;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickRecorderMime();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  let stopped = false;
  function teardown() {
    stream.getTracks().forEach((t) => t.stop());
  }

  recorder.start();

  return {
    async stop() {
      if (stopped) throw new Error("recorder already stopped");
      stopped = true;
      const done = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
      });
      recorder.stop();
      await done;
      teardown();
      // The mime on the Blob can include codec params (e.g. "audio/webm;codecs=opus").
      // The backend allowlist accepts the bare type, so we strip params before sending.
      const bareMime = mimeType.split(";")[0];
      return { blob: new Blob(chunks, { type: bareMime }), mimeType: bareMime };
    },
    cancel() {
      if (stopped) return;
      stopped = true;
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
      teardown();
    },
  };
}

/**
 * Send recorded audio to the backend and return the transcription.
 */
export async function transcribeAudio(
  slug: string,
  blob: Blob,
  mimeType: string,
): Promise<string> {
  const fd = new FormData();
  // The filename extension hints the OpenAI SDK at the format. Match the mime
  // we recorded with so the backend forwards a sensible extension.
  const ext = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mp4")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : "audio";
  fd.append("file", blob, `clip.${ext}`);
  const res = await fetch(`${VISITOR_BASE}/api/${slug}/voice/transcribe`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Transcribe failed: ${res.status}`);
  }
  const body = (await res.json()) as { text: string };
  return body.text;
}

/**
 * Synthesize and play TTS audio for `text` using the given voice character.
 * Returns a Promise that resolves when playback finishes (or rejects on error).
 *
 * Caller can pass an AbortSignal to cancel mid-flight.
 */
export async function playTTS(
  slug: string,
  voiceCharacterId: string,
  text: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${VISITOR_BASE}/api/${slug}/voice/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_character_id: voiceCharacterId }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `TTS failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  try {
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("ended", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("audio playback failed")), {
        once: true,
      });
      signal?.addEventListener("abort", () => {
        audio.pause();
        resolve();
      });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
