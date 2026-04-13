import { useRef, useState } from "react";

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
    fetch(`/api/sentences/${sentenceId}/played`, {
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
    <div style={{ marginTop: "1rem" }}>
      <audio
        ref={audioRef}
        controls
        src={`/audio/${audioPath}`}
        style={{ width: "100%" }}
        onPlay={handlePlay}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = speed;
          }
        }}
      />
      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#888" }}>
        Speed:{" "}
        {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
          <button
            key={s}
            onClick={() => handleSpeedChange(s)}
            style={{
              marginLeft: "0.5rem",
              padding: "0.2rem 0.5rem",
              background: speed === s ? "#555" : "none",
              border: "1px solid #666",
              color: speed === s ? "#fff" : "#aaa",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
