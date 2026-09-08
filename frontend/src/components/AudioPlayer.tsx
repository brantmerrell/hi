import { useRef, useState } from "react";
import { apiUrl } from "../api";

interface Props {
  audioPath: string | null;
  sentenceId: string | null;
}

export default function AudioPlayer({ audioPath, sentenceId }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);

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
        onPlay={handlePlay}
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
