interface Props {
  audioPath: string | null;
}

export default function AudioPlayer({ audioPath }: Props) {
  if (!audioPath) return null;

  return (
    <div style={{ marginTop: "1rem" }}>
      <audio controls src={`/audio/${audioPath}`} style={{ width: "100%" }} />
    </div>
  );
}
