import { useState } from "react";
import { useNavigate } from "react-router";
import type { Bot } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { startBot, stopBot, restartBot, deleteBot, renewBot, getBotLogs, updateBotVars, getTemplateAppVars } from "@/lib/api";
import {
  Play, Square, RotateCcw, Trash2, FileText, Settings, Loader2,
  Timer, Calendar, Copy, Check, X, Eraser, Smartphone, AlertTriangle
} from "lucide-react";
import { LogViewer } from "./LogViewer";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { Modal } from "./Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BotCardProps {
  bot: Bot;
  onUpdate: () => void;
  deploying?: boolean;
  coinBalance?: number;
}

const RENEW_COST = 10;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case "running": return "text-green-400 bg-green-400/10 border-green-400/20";
    case "stopped": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    case "expired": return "text-red-400 bg-red-400/10 border-red-400/20";
    case "building": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    default: return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded transition-all ${copied ? "text-green-400" : "text-muted-foreground hover:text-foreground"}`}
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

interface AppVar {
  key: string;
  description: string;
  required: boolean;
  value: string;
}

export function BotCard({ bot, onUpdate, deploying = false, coinBalance = 0 }: BotCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [stopWarnOpen, setStopWarnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [sessionVar, setSessionVar] = useState(bot.sessionVar);
  const [editDevice, setEditDevice] = useState<"android" | "ios">("android");
  const [editExtraVars, setEditExtraVars] = useState<{ key: string; value: string }[]>([]);
  const [logsRefreshing, setLogsRefreshing] = useState(false);
  const [appVars, setAppVars] = useState<AppVar[]>([]);
  const [appVarsLoading, setAppVarsLoading] = useState(false);
  const [templateSessionUrl, setTemplateSessionUrl] = useState("");
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isRunning = bot.status === "running";
  const isStopped = bot.status === "stopped" || bot.status === "expired";

  const templateId = (bot as unknown as { templateId?: string }).templateId;
  const templateName = (bot as unknown as { templateName?: string }).templateName;
  const storedSessionUrl = (bot as unknown as { sessionIdUrl?: string }).sessionIdUrl || "";
  const isDefaultBot = !templateId;

  const displaySessionUrl = storedSessionUrl || templateSessionUrl || (isDefaultBot ? "https://session-id-generator-4xuy.onrender.com/pair" : "");

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(action);
    try {
      const res = await fn() as { success?: boolean; error?: string; code?: string };
      if (res && typeof res === "object" && "error" in res && res.error) {
        if (res.code === "INSUFFICIENT_COINS") {
          showToast("Insufficient SQ — redirecting to Top Up", "error");
          navigate("/topup");
        } else {
          showToast(res.error, "error");
        }
      } else {
        showToast(`${action} successful`, "success");
        onUpdate();
      }
    } catch {
      showToast(`Failed to ${action.toLowerCase()}`, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleViewLogs = async () => {
    setLogsRefreshing(true);
    try {
      const res = await getBotLogs(bot._id) as { logs?: string[] };
      setLogs(res.logs || []);
      setLogsOpen(true);
    } catch {
      showToast("Failed to fetch logs", "error");
    } finally {
      setLogsRefreshing(false);
    }
  };

  const handleRefreshLogs = async () => {
    setLogsRefreshing(true);
    try {
      const res = await getBotLogs(bot._id) as { logs?: string[] };
      setLogs(res.logs || []);
    } catch {
      showToast("Failed to refresh logs", "error");
    } finally {
      setLogsRefreshing(false);
    }
  };

  const handleOpenSettings = async () => {
    setSessionVar(bot.sessionVar);
    setEditExtraVars([]);
    setAppVars([]);
    setTemplateSessionUrl("");
    setEditOpen(true);
    if (templateId) {
      setAppVarsLoading(true);
      try {
        const res = await getTemplateAppVars(templateId) as { vars?: AppVar[]; sessionIdUrl?: string };
        setAppVars(res.vars || []);
        setTemplateSessionUrl(res.sessionIdUrl || "");
        setEditExtraVars((res.vars || []).map(v => ({ key: v.key, value: v.value || "" })));
      } catch {} finally {
        setAppVarsLoading(false);
      }
    }
  };

  const handleEditVars = async () => {
    if (!sessionVar.trim()) { showToast("Session ID is required", "error"); return; }
    const extraObj: Record<string, string> = {};
    for (const { key, value } of editExtraVars) { if (key.trim()) extraObj[key.trim()] = value; }
    await handleAction("Update", () => updateBotVars(bot._id, sessionVar.trim(), isDefaultBot ? editDevice : undefined, Object.keys(extraObj).length > 0 ? extraObj : undefined));
    setEditOpen(false);
  };

  const handleRenew = async () => {
    if (coinBalance < RENEW_COST) {
      showToast(`You need ${RENEW_COST} SQ to renew for 1 month`, "error");
      navigate("/topup");
      return;
    }
    await handleAction("Renew", () => renewBot(bot._id, 1));
    setRenewOpen(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteBot(bot._id);
      showToast("Bot deleted", "success");
      setDeleteOpen(false);
      onUpdate();
    } catch {
      showToast("Failed to delete bot", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmStop = async () => {
    setStopWarnOpen(false);
    await handleAction("Stop", () => stopBot(bot._id));
  };

  const canAffordRenew = coinBalance >= RENEW_COST;

  return (
    <>
      <div className="relative rounded-xl bg-card border border-border hover:border-border/80 transition-all duration-200">
        {deploying && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-base font-semibold">Deploying...</p>
            <p className="text-sm text-muted-foreground mt-1">Your bot is initializing</p>
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-medium truncate">{bot.herokuAppName}</p>
                <CopyButton text={bot.herokuAppName} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{bot.phoneNumber}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${getStatusColor(bot.status)}`}>
                {bot.status}
              </span>
              {templateName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20 whitespace-nowrap">
                  {templateName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>Expires: {formatDate(bot.expiresAt)}</span>
          </div>

          {bot.isTrial && (
            <div className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20 inline-block mb-3">
              Free Trial
            </div>
          )}
          {bot.status === "expired" && !bot.isTrial && (
            <div className="text-xs bg-orange-500/10 text-orange-400 px-3 py-2 rounded-lg border border-orange-500/20 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Subscription expired — renew within 24 hours or this bot will be permanently deleted.
            </div>
          )}

          {!deploying && (
            <div className="flex flex-wrap gap-1.5">
              {isRunning ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStopWarnOpen(true)}
                  disabled={!!loading}
                  className="h-8 text-xs bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  title="Stop your bot (it will go offline)"
                >
                  {loading === "Stop" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                  Stop
                </Button>
              ) : isStopped ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("Start", () => startBot(bot._id))}
                  disabled={!!loading}
                  className="h-8 text-xs bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                  title="Start your bot"
                >
                  {loading === "Start" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                  Start
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction("Restart", () => restartBot(bot._id))}
                disabled={!!loading || !isRunning}
                className={`h-8 text-xs ${!isRunning ? "opacity-40 cursor-not-allowed" : ""}`}
                title={!isRunning ? "Bot must be running to restart" : "Restart your bot (useful after a crash or update)"}
              >
                <RotateCcw className={`w-3 h-3 mr-1 ${loading === "Restart" ? "animate-spin" : ""}`} />
                Restart
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleViewLogs}
                disabled={logsRefreshing || !isRunning}
                className={`h-8 text-xs ${!isRunning ? "opacity-40 cursor-not-allowed" : ""}`}
                title={!isRunning ? "Bot must be running to view logs" : "View recent activity/output from your bot"}
              >
                {logsRefreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                Logs
              </Button>

              <Button size="sm" variant="outline" onClick={handleOpenSettings} className="h-8 text-xs">
                <Settings className="w-3 h-3 mr-1" />
                Bot Settings
              </Button>

              {!bot.isTrial && bot.status === "expired" && (
                <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)} className="h-8 text-xs bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300" title="Renew an expired bot using SQ coins">
                  <Timer className="w-3 h-3 mr-1" />
                  Renew Now
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10"
                onClick={() => setDeleteOpen(true)}
                disabled={!!loading || deleteLoading}
              >
                {deleteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      <LogViewer
        isOpen={logsOpen}
        onClose={() => setLogsOpen(false)}
        logs={logs}
        botName={bot.herokuAppName}
        onRefresh={handleRefreshLogs}
        refreshing={logsRefreshing}
      />

      <Modal isOpen={stopWarnOpen} onClose={() => setStopWarnOpen(false)} title="Stop Bot?" maxWidth="max-w-md">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-12 h-12 rounded-full bg-yellow-900/40 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-medium">{bot.herokuAppName}</p>
            <p className="text-muted-foreground text-sm">
              Stopping this bot will put it in maintenance mode. It will be unreachable until started again.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStopWarnOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white border-0"
              onClick={handleConfirmStop}
              disabled={loading === "Stop"}
            >
              {loading === "Stop" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Square className="w-4 h-4 mr-1" />}
              Stop Bot
            </Button>
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title={`Delete ${bot.herokuAppName}?`}
        description="This will permanently delete the bot and cannot be undone."
      />

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Bot Settings" maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Session ID</Label>
            <div className="flex gap-2">
              <Input
                value={sessionVar}
                onChange={e => setSessionVar(e.target.value)}
                placeholder="Paste new session ID"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setSessionVar("")}
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Clear Session"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
            {displaySessionUrl && (
              <p className="text-xs text-muted-foreground mt-1">
                Get a new session at{" "}
                <a
                  href={displaySessionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  {displaySessionUrl.replace(/^https?:\/\//, "").split("/")[0]}
                </a>
              </p>
            )}
          </div>

          {isDefaultBot && (
            <div>
              <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" /> Device Type
              </Label>
              <Select value={editDevice} onValueChange={(v: "android" | "ios") => setEditDevice(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="android">Android — Interactive buttons</SelectItem>
                  <SelectItem value="ios">iOS — Text-only responses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {appVarsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading bot configuration...
            </div>
          )}

          {!appVarsLoading && appVars.length > 0 && (
            <div className="space-y-3">
              {appVars.map((varDef) => {
                const current = editExtraVars.find(v => v.key === varDef.key)?.value ?? "";
                return (
                  <div key={varDef.key}>
                    <Label className="text-sm font-medium mb-1.5 block">
                      {varDef.description}
                      {varDef.required && <span className="text-red-400 ml-1">*</span>}
                    </Label>
                    <Input
                      value={current}
                      onChange={e => setEditExtraVars(prev => {
                        const idx = prev.findIndex(v => v.key === varDef.key);
                        if (idx >= 0) return prev.map((v, i) => i === idx ? { ...v, value: e.target.value } : v);
                        return [...prev, { key: varDef.key, value: e.target.value }];
                      })}
                      placeholder={varDef.value || varDef.key}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleEditVars} disabled={!!loading || appVarsLoading}>
              {loading === "Update" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={renewOpen} onClose={() => setRenewOpen(false)} title="Renew Bot" maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Renewal period</span>
              <span className="font-semibold">1 month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-semibold">{RENEW_COST} SQ</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your balance</span>
              <span className={`font-semibold ${canAffordRenew ? "text-purple-400" : "text-red-400"}`}>{coinBalance} TX</span>
            </div>
          </div>
          {!canAffordRenew && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              Insufficient TX. You need {RENEW_COST} SQ but have {coinBalance} TX.
            </div>
          )}
          <Button
            className={`w-full ${!canAffordRenew ? "opacity-60" : ""}`}
            onClick={canAffordRenew ? handleRenew : () => navigate("/topup")}
            disabled={!!loading}
          >
            {loading === "Renew" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {canAffordRenew ? `Renew — ${RENEW_COST} SQ` : "Top Up to Renew"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
