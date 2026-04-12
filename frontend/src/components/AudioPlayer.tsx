interface Props {
  audioPath: string | null;
  sentenceId: string | null;
}

export default function AudioPlayer({ audioPath, sentenceId }: Props) {
  if (!audioPath) return null;

  function handlePlay() {
    if (!sentenceId) return;
    fetch(`/api/sentences/${sentenceId}/played`, {
      method: "POST",
      credentials: "include",
    });
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <audio
        controls
        src={`/audio/${audioPath}`}
        style={{ width: "100%" }}
        onPlay={handlePlay}
      />
    </div>
  );
}
