export function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent"
          style={{
            borderTopColor: "hsl(var(--primary))",
            borderRightColor: "hsl(var(--primary) / 0.4)",
            animation: "spin 1s linear infinite"
          }}
        />
        <div
          className="absolute rounded-full border-4 border-transparent"
          style={{
            inset: "8px",
            borderBottomColor: "hsl(var(--primary))",
            borderLeftColor: "hsl(var(--primary) / 0.3)",
            animation: "spin 0.75s linear infinite reverse"
          }}
        />
        <div
          className="absolute rounded-full border-2 border-transparent"
          style={{
            inset: "18px",
            borderTopColor: "hsl(var(--primary) / 0.8)",
            animation: "spin 0.5s linear infinite"
          }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        />
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
