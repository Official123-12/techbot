import { useEffect, useRef, useState } from "react";
  import { Modal } from "./Modal";
  import { RotateCcw, Loader2, Copy, Check } from "lucide-react";

    interface LogViewerProps {
      isOpen: boolean;
      onClose: () => void;
      logs: string[];
      botName: string;
      onRefresh: () => Promise<void>;
      refreshing: boolean;
    }

    type LogLevel = "error" | "warn" | "ok" | "info" | "debug";

    function classifyLog(log: string): LogLevel {
      const l = log.toLowerCase();
      if (l.includes("error") || l.includes("fail") || l.includes("fatal") || l.includes("exception")) return "error";
      if (l.includes("warn")) return "warn";
      if (l.includes("success") || l.includes("done") || l.includes("connected") || l.includes("✅") || l.includes("started")) return "ok";
      if (l.includes("info") || l.includes("[db]") || l.includes("server") || l.includes("running")) return "info";
      return "debug";
    }

    const LEVEL_META: Record<LogLevel, { label: string; color: string; dim: string }> = {
      error: { label: "ERR", color: "#f87171", dim: "#7f1d1d" },
      warn:  { label: "WRN", color: "#fbbf24", dim: "#78350f" },
      ok:    { label: " OK", color: "#4ade80", dim: "#14532d" },
      info:  { label: "INF", color: "#60a5fa", dim: "#1e3a5f" },
      debug: { label: "DBG", color: "#9ca3af", dim: "#1f2937" },
    };

    function stripTimestamp(log: string): string {
      return log.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+?\d*:\d*\s*(app\[web\.\d+\]:\s*)?/, "").trim();
    }


      function CopyLogsButton({ logs }: { logs: string[] }) {
        const [copied, setCopied] = useState(false);
        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(logs.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        };
        return (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-all"
            style={{
              background: copied ? "#052e16" : "#1f2937",
              color: copied ? "#4ade80" : "#6b7280",
              border: copied ? "1px solid #166534" : "1px solid #374151",
              transform: copied ? "scale(0.97)" : "scale(1)"
            }}
            title="Copy all logs"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "copied!" : "copy"}
          </button>
        );
      }

      export function LogViewer({ isOpen, onClose, logs, botName, onRefresh, refreshing }: LogViewerProps) {
      const bottomRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (isOpen && bottomRef.current) {
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
        }
      }, [isOpen, logs]);

      return (
        <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-3xl">
          <div className="rounded-lg overflow-hidden" style={{ background: "#0a0e14", border: "1px solid #1a2332" }}>
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ background: "#111827", borderBottom: "1px solid #1a2332" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />
                </div>
                <span className="text-xs font-mono truncate" style={{ color: "#6ee7b7" }}>
                  $ toxic-md — {botName}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-xs font-mono" style={{ color: "#374151" }}>{logs.length} lines</span>
                <CopyLogsButton logs={logs} />
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-all disabled:opacity-40"
                  style={{ background: "#1f2937", color: "#6b7280", border: "1px solid #374151" }}
                >
                  {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  refresh
                </button>
              </div>
            </div>

            <div
              className="h-[55vh] min-h-[220px] overflow-y-auto overflow-x-hidden w-full"
              style={{ background: "#0a0e14" }}
            >
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "#374151" }}>
                  <span className="font-mono text-sm">$ _</span>
                  <p className="text-xs font-mono">no output yet</p>
                </div>
              ) : (
                <div className="py-1">
                  {logs.map((log, i) => {
                    const content = stripTimestamp(log);
                    const level = classifyLog(content || log);
                    const meta = LEVEL_META[level];
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-0 group"
                        style={{ fontFamily: "monospace" }}
                      >
                        <span
                          className="shrink-0 select-none text-right px-2 py-0.5"
                          style={{ color: "#1f2937", fontSize: "9px", width: "2rem", lineHeight: "1.6" }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="shrink-0 px-1 py-0.5 select-none font-bold"
                          style={{ color: meta.color, fontSize: "9px", lineHeight: "1.6", letterSpacing: "0.02em" }}
                        >
                          [{meta.label}]
                        </span>
                        <span
                          className="px-1.5 py-0.5 flex-1 min-w-0"
                          style={{
                            color: meta.color,
                            fontSize: "11px",
                            lineHeight: "1.6",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            whiteSpace: "pre-wrap",
                            opacity: level === "debug" ? 0.75 : 1,
                          }}
                        >
                          {content || log}
                        </span>
                      </div>
                    );
                  })}
                  <div
                    className="flex items-center gap-1 px-2 py-1"
                    style={{ color: "#4ade80", fontSize: "11px", fontFamily: "monospace" }}
                  >
                    <span style={{ color: "#22c55e" }}>$</span>
                    <span className="animate-pulse">▋</span>
                  </div>
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </div>
        </Modal>
      );
    }