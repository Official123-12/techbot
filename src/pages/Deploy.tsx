import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deployBot } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { TechBackground } from "@/components/TechBackground";
import { PageLoader } from "@/components/PageLoader";
import { useNavLoader } from "@/App";
import {
  ArrowLeft, ExternalLink, Loader2, Check, CreditCard,
  Smartphone, Apple, Sparkles, KeyRound, Hash, Rocket,
  ChevronRight, Copy, Info, AlertCircle
} from "lucide-react";

const DEPLOY_COST = 10;

function sanitizeName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
}

function buildAppName(name: string): string {
  const clean = sanitizeName(name);
  const rand = Math.floor(100 + Math.random() * 900);
  return `toxichost-${clean}${rand}`;
}

function StepBadge({ number }: { number: number }) {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold shrink-0 text-primary-foreground">
      {number}
    </div>
  );
}

export function Deploy() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [botName, setBotName] = useState("");
  const [sessionVar, setSessionVar] = useState("");
  const [device, setDevice] = useState("android");
  const [isTrial, setIsTrial] = useState(() => searchParams.get("trial") === "true");
  const [loading, setLoading] = useState(false);

  const getSessionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading) return <PageLoader />;
  if (!user) return null;

  const coinBalance = user.txCoins;
  const insufficientBalance = !isTrial && coinBalance < DEPLOY_COST;

  const handleDeploy = async () => {
    if (insufficientBalance) {
      navigateWithLoader("/topup");
      return;
    }
    const nameTrimmed = botName.trim();
    if (sanitizeName(nameTrimmed).length < 5) {
      showToast("Name must have at least 5 letters (a-z)", "error");
      return;
    }
    const trimmedSession = sessionVar.trim();
    if (!trimmedSession) {
      showToast("Session ID is required — get it from Step 1 above", "error");
      getSessionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const appName = buildAppName(nameTrimmed);
    setLoading(true);
    try {
      const res = await deployBot({
        botName: appName,
        sessionVar: trimmedSession,
        isTrial,
        device,
        months: 1,
      });
      if (res.success) {
        showToast(isTrial ? "Trial bot deployed!" : "Bot deployed! Building in ~2 minutes...", "success");
        const finalName = res.bot?.herokuAppName || appName;
        localStorage.setItem("deployingBot", JSON.stringify({ appName: finalName, startTime: Date.now() }));
        refreshUser();
        navigate("/mybots");
      } else {
        if (res.code === "INSUFFICIENT_COINS") {
          showToast("Insufficient TX Coins — redirecting to Top Up", "error");
          navigateWithLoader("/topup");
        } else {
          showToast(res.error || "Failed to deploy bot", "error");
        }
      }
    } catch {
      showToast("Failed to deploy bot", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {loading && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background/90 backdrop-blur-sm">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
            <Rocket className="w-6 h-6 text-purple-400 absolute inset-0 m-auto" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-bold">Deploying your bot...</p>
            <p className="text-sm text-muted-foreground">Building takes about 2 minutes. Please wait.</p>
          </div>
        </div>
      )}
      <TechBackground />

      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">
            <button
              onClick={() => navigateWithLoader("/services/bots")}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-base leading-tight">Deploy Toxic MD</h1>
              <p className="text-xs text-muted-foreground">Follow the steps below carefully</p>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 relative z-[1] space-y-5 pb-24">

        <button
          type="button"
          onClick={() => setIsTrial(!isTrial)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${
            isTrial
              ? "bg-gradient-to-r from-purple-500/20 to-violet-500/15 border-purple-500/70 text-purple-200"
              : "bg-gradient-to-r from-purple-500/8 to-violet-500/5 border-purple-500/40 text-foreground hover:border-purple-500/60 hover:from-purple-500/15 hover:to-violet-500/10"
          }`}
        >
          {!isTrial && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent animate-pulse pointer-events-none" style={{ animationDuration: "2s" }} />
          )}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isTrial ? "bg-purple-500/30" : "bg-purple-500/15"}`}>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold">Free Trial — 24 Hours</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500 text-white leading-none shrink-0">FREE</span>
            </div>
            <p className="text-xs mt-0.5 text-purple-300/80">No TX coins required · Runs for 24 hours · One per WhatsApp number</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${isTrial ? "bg-purple-500 border-purple-500" : "border-purple-500/50"}`}>
            {isTrial && <Check className="w-3 h-3 text-white" />}
          </div>
        </button>

        <div ref={getSessionRef} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
            <StepBadge number={1} />
            <div className="flex-1">
              <p className="font-semibold text-sm">Get Your Session ID</p>
              <p className="text-xs text-muted-foreground">You must do this before deploying</p>
            </div>
            <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <div className="p-4 space-y-4">
            <div className="p-3 rounded-lg bg-blue-500/8 border border-blue-500/20 flex gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200 space-y-1">
                <p className="font-semibold text-blue-300">What is a Session ID?</p>
                <p>A Session ID connects your WhatsApp account to the bot. You get it by scanning a QR code or entering a pairing code on the session generator page.</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                A valid Session ID looks like this:
              </p>
              <div className="bg-muted rounded-lg p-3 font-mono text-xs text-muted-foreground break-all leading-relaxed border border-border/50 select-all">
                eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoid0RMcW9mS21xY1FBN2VzeUtSd1lBRDZER3BxVXhuam5ObjFOVUdkY0ZrTT0i...
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                It is a very long string — make sure you copy the <span className="font-semibold text-foreground mx-0.5">entire</span> value, not just part of it
              </p>
            </div>

            <a
              href="https://toxicx.tech/pairing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full p-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2.5">
                <ExternalLink className="w-4 h-4" />
                Get Session ID at toxicx.tech/pairing
              </div>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </a>

            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                Open the link above
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                Enter your WhatsApp number or scan the QR code
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                Copy the <span className="font-semibold text-foreground mx-0.5">full</span> session string that appears
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                Come back here and paste it in Step 3 below
              </li>
            </ol>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
            <StepBadge number={2} />
            <div className="flex-1">
              <p className="font-semibold text-sm">Bot Name</p>
              <p className="text-xs text-muted-foreground">At least 5 letters — used to identify your bot</p>
            </div>
            <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <div className="p-4">
            <Label htmlFor="botname">Name</Label>
            <Input
              id="botname"
              placeholder="e.g. mybot or johnbot"
              value={botName}
              onChange={e => setBotName(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
              maxLength={20}
              className="mt-1"
            />
            {botName && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <Info className="w-3 h-3 shrink-0" />
                App name: <span className="font-mono text-foreground ml-1">toxichost-{sanitizeName(botName)}###</span>
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
            <StepBadge number={3} />
            <div className="flex-1">
              <p className="font-semibold text-sm">Paste Your Session ID</p>
              <p className="text-xs text-muted-foreground">Copied from Step 1 above</p>
            </div>
            <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <div className="p-4 space-y-3">
            <div>
              <Label htmlFor="session">Session ID</Label>
              <textarea
                id="session"
                placeholder="Paste your full session ID here — it starts with eyJ..."
                value={sessionVar}
                onChange={e => setSessionVar(e.target.value)}
                rows={4}
                className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              />
            </div>
            <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 space-y-0.5">
                <p className="font-semibold text-amber-300">Paste the complete string</p>
                <p>A valid Session ID is very long (hundreds of characters). If it looks short, go back to Step 1 and copy the full value.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
            <StepBadge number={4} />
            <div className="flex-1">
              <p className="font-semibold text-sm">Device Mode</p>
              <p className="text-xs text-muted-foreground">How the bot appears to other users</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <Select value={device} onValueChange={setDevice}>
              <SelectTrigger className="w-full h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom">
                <SelectItem value="android">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-green-400" />
                    Android
                  </div>
                </SelectItem>
                <SelectItem value="ios">
                  <div className="flex items-center gap-2">
                    <Apple className="w-3.5 h-3.5 text-blue-400" />
                    iOS
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className={`p-3 rounded-lg border text-xs ${device === "android" ? "bg-green-500/8 border-green-500/20 text-green-300" : "bg-blue-500/8 border-blue-500/20 text-blue-300"}`}>
              {device === "android" ? (
                <div className="flex items-start gap-2">
                  <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-400" />
                  <span><span className="font-semibold">Android mode</span> — Full interactive experience. Bot sends interactive buttons, menus, and quick-reply options in chats.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Apple className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                  <span><span className="font-semibold">iOS mode</span> — Text-only. No interactive buttons are sent. Commands still work but responses are plain text.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isTrial && (
          <div className={`p-4 rounded-xl border text-sm transition-all ${insufficientBalance ? "bg-red-500/10 border-red-500/30" : "bg-muted/50 border-border"}`}>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cost (1 month)</span>
              <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-foreground"}`}>{DEPLOY_COST} TX</span>
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-muted-foreground">Your balance</span>
              <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-purple-400"}`}>{coinBalance} TX</span>
            </div>
            {insufficientBalance && (
              <p className="text-xs mt-3 text-red-400">
                You need {DEPLOY_COST - coinBalance} more TX to deploy.{" "}
                <button onClick={() => navigateWithLoader("/topup")} className="underline font-semibold">Top up now →</button>
              </p>
            )}
          </div>
        )}

        <Button
          className={`w-full h-12 text-base font-semibold ${insufficientBalance ? "opacity-70" : ""}`}
          onClick={handleDeploy}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Deploying...</>
          ) : insufficientBalance ? (
            <><CreditCard className="w-5 h-5 mr-2" />Top Up — Insufficient Balance</>
          ) : (
            <><Rocket className="w-5 h-5 mr-2" />{isTrial ? "Deploy Free Trial" : `Deploy Bot — ${DEPLOY_COST} TX / month`}</>
          )}
        </Button>
      </main>
    </div>
  );
}
