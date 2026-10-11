import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";
import type { SentenceWord } from "../types";

interface Props {
  audioPath: string | null;
  sentenceId: string | null;
  words?: SentenceWord[];
  onActiveWordChange?: (wordId: string | null) => void;
}

// The last word whose start time has been reached (words are ordered by position).
function activeWordAt(words: SentenceWord[], ms: number): string | null {
  let active: string | null = null;
  for (const w of words) {
    if (w.start_ms !== null && w.start_ms <= ms) active = w.id;
  }
  return active;
}

export default function AudioPlayer({ audioPath, sentenceId, words, onActiveWordChange }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef<number | null>(null);
  // The animation-frame loop outlives renders, so it reads the latest props via a ref
  const latest = useRef({ words, onActiveWordChange });
  latest.current = { words, onActiveWordChange };

  function syncHighlight() {
    const audio = audioRef.current;
    const { words, onActiveWordChange } = latest.current;
    if (!audio || !words || !onActiveWordChange) return;
    onActiveWordChange(activeWordAt(words, audio.currentTime * 1000));
  }

  function stopLoop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  // timeupdate only fires ~4x/second, so poll each frame while playing
  function startLoop() {
    stopLoop();
    const tick = () => {
      syncHighlight();
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => stopLoop, []);

  if (!audioPath) return null;

  function handlePlay() {
    if (!sentenceId) return;
    fetch(apiUrl(`/api/sentences/${sentenceId}/played`), {
      method: "POST",
      credentials: "include",
    });
  }

  function handleSpeedChange(newSpeed: number) {
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  }

  return (
    <div className="mt-4">
      <audio
        ref={audioRef}
        controls
        src={apiUrl(`/audio/${audioPath}`)}
        style={{ width: "100%", height: "3rem" }}
        onPlay={() => {
          handlePlay();
          startLoop();
        }}
        onPause={stopLoop}
        onEnded={() => {
          stopLoop();
          onActiveWordChange?.(null);
        }}
        onTimeUpdate={syncHighlight}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = speed;
          }
        }}
      />
      <div className="field is-grouped mt-2 is-align-items-center">
        <span className="is-size-7 has-text-grey mr-2">Speed:</span>
        <div className="buttons has-addons mb-0">
          {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
            <button
              key={s}
              className={`button is-small ${speed === s ? "is-link is-selected" : ""}`}
              onClick={() => handleSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
