export default function LoadingSpinner() {
  return (
    <>
      <div
        className="is-size-1"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          animation: "spin 1s linear infinite",
          pointerEvents: "none",
        }}
      >
        ⟳
      </div>
      <style>{`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </>
  );
}
