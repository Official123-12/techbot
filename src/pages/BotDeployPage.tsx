import { useState, useRef, useEffect } from "react";
  import { useNavigate, useParams } from "react-router";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { deployBotWithTemplate } from "@/lib/api";
  import { useToast } from "@/hooks/useToast";
  import { useAuth } from "@/hooks/useAuth";
  import { TechBackground } from "@/components/TechBackground";
  import { PageLoader } from "@/components/PageLoader";
  import { useNavLoader } from "@/App";
  import { Modal } from "@/components/Modal";
  import type { BotTemplate } from "@/types";
  import { getBotTemplateBySlug } from "@/lib/api";
  import {
    ArrowLeft, ExternalLink, Loader2, Check,
    Smartphone, Apple, Rocket, ChevronRight, ClipboardPaste,
    Info, AlertCircle, ChevronDown, KeyRound, Hash
  } from "lucide-react";

  const DEPLOY_COST = 10;
  const AUTO_VARS = new Set(["BOT_NAME", "HEROKU_APP_NAME", "HEROKU_API_KEY", "DEVICE"]);
  const SESSION_KEYS = ["SESSION", "CREDS", "SESSION_ID", "SESSION_TOKEN", "AUTH"];
  const SENSITIVE_KEYS = new Set(["HEROKU_API_KEY", "SESSION", "CREDS", "SESSION_ID", "SESSION_TOKEN", "AUTH", "API_KEY", "SECRET", "PASSWORD", "TOKEN"]);

  function StepBadge({ number }: { number: number }) {
    return (
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold shrink-0 text-primary-foreground">
        {number}
      </div>
    );
  }

  function sanitizeName(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  }

  function buildAppName(name: string): string {
    const clean = sanitizeName(name);
    const rand = Math.floor(100 + Math.random() * 900);
    return `toxichost-${clean}${rand}`;
  }

  interface AppJsonEnvVar {
    description: string;
    required: boolean;
    value: string;
  }

  export function BotDeployPage() {
    const { slug } = useParams<{ slug: string }>();
    const { user, loading: authLoading, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { navigateWithLoader } = useNavLoader();
    const { showToast } = useToast();

    const [template, setTemplate] = useState<BotTemplate | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(true);
    const [botName, setBotName] = useState("");
    const [sessionVar, setSessionVar] = useState("");
    const [device, setDevice] = useState("android");
    const [loading, setLoading] = useState(false);
    const [optionalOpen, setOptionalOpen] = useState(false);
    const [lowBalanceModal, setLowBalanceModal] = useState(false);

    const [appJsonEnv, setAppJsonEnv] = useState<Record<string, AppJsonEnvVar>>({});
    const [requiredVarValues, setRequiredVarValues] = useState<Record<string, string>>({});
    const [optionalVarValues, setOptionalVarValues] = useState<Record<string, string>>({});
    const [loadingAppJson, setLoadingAppJson] = useState(false);

    const getSessionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!authLoading && !user) navigate("/login");
    }, [user, authLoading, navigate]);

    useEffect(() => {
      if (!slug || authLoading) return;
      getBotTemplateBySlug(slug)
        .then(data => {
          if (data && !data.error) setTemplate(data);
          else navigate("/services/bots");
        })
        .catch(() => navigate("/services/bots"))
        .finally(() => setLoadingTemplate(false));
    }, [slug, navigate, authLoading]);

    useEffect(() => {
      if (!template || template.isDefault) return;
      const match = template.githubRepo.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return;
      const [, owner, repoName] = match;
      const cleanRepo = repoName.replace(/\.git$/, "");
      setLoadingAppJson(true);
      (async () => {
          const branches = ["main", "master", "HEAD"];
          let appJson: { env?: Record<string, { description?: string; required?: boolean; value?: string }> } | null = null;
          for (const branch of branches) {
            try {
              const r = await fetch(`https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/app.json`);
              if (r.ok) { appJson = await r.json(); break; }
            } catch {}
          }
          if (appJson?.env) {
            const filtered: Record<string, AppJsonEnvVar> = {};
            const reqVals: Record<string, string> = {};
            const optVals: Record<string, string> = {};
            for (const [k, v] of Object.entries(appJson.env)) {
              if (AUTO_VARS.has(k)) continue;
              const isReq = v.required !== false;
              const defaultVal = v.value || "";
              filtered[k] = { description: v.description || "", required: isReq, value: defaultVal };
              if (isReq) reqVals[k] = defaultVal;
              else optVals[k] = defaultVal;
            }
            setAppJsonEnv(filtered);
            setRequiredVarValues(reqVals);
            setOptionalVarValues(optVals);
          }
          setLoadingAppJson(false);
        })();
      }, [template]);

    if (authLoading || loadingTemplate) return <PageLoader />;
    if (!user || !template) return <PageLoader />;

    const cost = template.costTx ?? DEPLOY_COST;
    const insufficientBalance = user.txCoins < cost;

    const requiredKeys = Object.entries(appJsonEnv).filter(([, v]) => v.required).map(([k]) => k);
    const optionalKeys = Object.entries(appJsonEnv).filter(([, v]) => !v.required).map(([k]) => k);

    const handleDeploy = async () => {
      if (insufficientBalance) { setLowBalanceModal(true); return; }
      const nameTrimmed = botName.trim();
      if (sanitizeName(nameTrimmed).length < 5) { showToast("Name must have at least 5 letters (a-z)", "error"); return; }

      if (template.isDefault) {
        const trimmedSession = sessionVar.trim();
        if (!trimmedSession) {
          showToast("Session ID is required", "error");
          getSessionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        const appName = buildAppName(nameTrimmed);
        setLoading(true);
        try {
          const res = await deployBotWithTemplate({ botTemplateId: template._id, botName: appName, sessionVar: trimmedSession, device, months: 1 }) as { success?: boolean; error?: string; code?: string; bot?: { herokuAppName: string } };
          if (res.success) {
            showToast("Bot deployed! Building in ~2 minutes...", "success");
            localStorage.setItem("deployingBot", JSON.stringify({ appName: res.bot?.herokuAppName || appName, startTime: Date.now() }));
            await refreshUser();
            navigate("/mybots");
          } else if (res.code === "INSUFFICIENT_COINS") {
            setLowBalanceModal(true);
          } else {
            showToast(res.error || "Deployment failed", "error");
          }
        } catch { showToast("Deployment failed — please try again", "error"); }
        finally { setLoading(false); }
      } else {
        const missingRequired = requiredKeys.filter(k => !requiredVarValues[k]?.trim());
        if (missingRequired.length > 0) { showToast(`Please fill in: ${missingRequired.join(", ")}`, "error"); return; }

        const allVars: Record<string, string> = {};
        for (const [k, v] of Object.entries(requiredVarValues)) { if (v.trim()) allVars[k] = v.trim(); }
        for (const [k, v] of Object.entries(optionalVarValues)) { if (v.trim()) allVars[k] = v.trim(); }

        const sessionKey = Object.keys(allVars).find(k => SESSION_KEYS.includes(k.toUpperCase()));
        const sessionValue = sessionKey ? allVars[sessionKey] : (Object.values(allVars)[0] || "placeholder");

        const appName = buildAppName(nameTrimmed);
        setLoading(true);
        try {
          const res = await deployBotWithTemplate({ botTemplateId: template._id, botName: appName, sessionVar: sessionValue, device, months: 1, extraVars: allVars }) as { success?: boolean; error?: string; code?: string; bot?: { herokuAppName: string } };
          if (res.success) {
            showToast("Bot deployed! Building in ~2 minutes...", "success");
            localStorage.setItem("deployingBot", JSON.stringify({ appName: res.bot?.herokuAppName || appName, startTime: Date.now() }));
            await refreshUser();
            navigate("/mybots");
          } else if (res.code === "INSUFFICIENT_COINS") {
            setLowBalanceModal(true);
          } else {
            showToast(res.error || "Deployment failed", "error");
          }
        } catch { showToast("Deployment failed — please try again", "error"); }
        finally { setLoading(false); }
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
            <div className="flex items-center gap-3 h-14">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="font-semibold text-sm">{template.name}</p>
                <p className="text-xs text-muted-foreground">Deploy Bot</p>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {template.imageUrl && (
            <div className="rounded-xl overflow-hidden aspect-video max-h-48 border border-border">
              <img src={template.imageUrl} alt={template.name} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-4 rounded-xl border border-border bg-card text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cost</span>
              <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-purple-400"}`}>{cost} SQ / month</span>
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-muted-foreground">Your balance</span>
              <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-purple-400"}`}>{user.txCoins} SQ</span>
            </div>
            {insufficientBalance && (
              <p className="text-xs mt-3 text-red-400">
                You need {cost - user.txCoins} more TX.{" "}
                <button onClick={() => navigateWithLoader("/topup")} className="underline font-semibold">Top up now →</button>
              </p>
            )}
          </div>

          <div ref={getSessionRef} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
              <StepBadge number={1} />
              <div className="flex-1">
                <p className="font-semibold text-sm">Get Your Session ID</p>
                <p className="text-xs text-muted-foreground">Connect your WhatsApp account to the bot</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <a href={template.sessionIdUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity">
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="w-4 h-4" />
                  Get Session ID
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </a>
              {template.isDefault && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    A valid Session ID looks like:
                  </p>
                  <div className="bg-muted rounded-lg p-3 font-mono text-xs text-muted-foreground break-all leading-relaxed border border-border/50 select-all">
                    eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIi...
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                    Copy the <span className="font-semibold text-foreground mx-0.5">entire</span> value — it is very long
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
              <StepBadge number={2} />
              <div className="flex-1">
                <p className="font-semibold text-sm">Bot Name</p>
                <p className="text-xs text-muted-foreground">At least 5 letters — used to identify your bot</p>
              </div>
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

          {template.isDefault ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
                <StepBadge number={3} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Paste Your Session ID</p>
                  <p className="text-xs text-muted-foreground">Copied from Step 1 above</p>
                </div>
                <ClipboardPaste className="w-4 h-4 text-muted-foreground shrink-0" />
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
                    <p>A valid Session ID is very long (hundreds of characters).</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
                <StepBadge number={3} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Required Variables</p>
                  <p className="text-xs text-muted-foreground">Fill in all required values for this bot</p>
                </div>
              </div>
              <div className="p-4">
                {loadingAppJson ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : requiredKeys.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No required variables found for this bot.</p>
                ) : (
                  <div className="space-y-4">
                    {requiredKeys.map(k => (
                      <div key={k}>
                        <Label htmlFor={`req-${k}`} className="font-mono text-xs font-semibold">{k}</Label>
                        {appJsonEnv[k]?.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 mb-1">{appJsonEnv[k].description}</p>
                        )}
                        <textarea
                          id={`req-${k}`}
                          placeholder={SENSITIVE_KEYS.has(k.toUpperCase()) ? "Value hidden for security" : `Enter value for ${k}`}
                          value={requiredVarValues[k] || ""}
                          onChange={e => setRequiredVarValues(prev => ({ ...prev, [k]: e.target.value }))}
                          rows={2}
                          className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {template.isDefault && (
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
                      <span><span className="font-semibold">Android mode</span> — Full interactive experience with buttons and menus.</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Apple className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                      <span><span className="font-semibold">iOS mode</span> — Text-only. Commands still work but responses are plain text.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {template.isDefault ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOptionalOpen(o => !o)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <span>Optional Environment Variables</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${optionalOpen ? "rotate-180" : ""}`} />
              </button>
              {optionalOpen && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground mb-3">These are set automatically. You can override them after deployment from the Heroku dashboard.</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {[
                      { key: "BOT_NAME", desc: "Display name of the bot (auto-set)" },
                      { key: "HEROKU_APP_NAME", desc: "Heroku app identifier (auto-set)" },
                      { key: "HEROKU_API_KEY", desc: "API key for Heroku (auto-set)" },
                    ].map(env => (
                      <div key={env.key} className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                        <p className="font-mono text-xs font-semibold">{env.key}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{env.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : optionalKeys.length > 0 ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOptionalOpen(o => !o)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <span>Optional Environment Variables</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${optionalOpen ? "rotate-180" : ""}`} />
              </button>
              {optionalOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground">These are optional — leave blank to use defaults.</p>
                  {optionalKeys.filter(k => !AUTO_VARS.has(k)).map(k => (
                    <div key={k}>
                      <Label htmlFor={`opt-${k}`} className="font-mono text-xs font-semibold">{k}</Label>
                      {appJsonEnv[k]?.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 mb-1">{appJsonEnv[k].description}</p>
                      )}
                      <Input
                        id={`opt-${k}`}
                        placeholder={SENSITIVE_KEYS.has(k.toUpperCase()) ? "Value hidden for security" : `Optional — ${k}`}
                        value={optionalVarValues[k] || ""}
                        onChange={e => setOptionalVarValues(prev => ({ ...prev, [k]: e.target.value }))}
                        className="mt-0.5 font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <Button
            className={`w-full h-12 text-base font-semibold ${insufficientBalance ? "opacity-70" : ""}`}
            onClick={handleDeploy}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Deploying...</>
            ) : insufficientBalance ? (
              <><Check className="w-5 h-5 mr-2" />Top Up — Insufficient Balance</>
            ) : (
              <><Rocket className="w-5 h-5 mr-2" />Deploy Bot — {cost} SQ / month</>
            )}
          </Button>
        </main>

        <Modal isOpen={lowBalanceModal} onClose={() => setLowBalanceModal(false)} title="Insufficient Balance" maxWidth="max-w-sm">
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                You need <span className="font-bold text-foreground">{cost} SQ</span> to deploy this bot, but you only have <span className="font-bold text-red-400">{user.txCoins} SQ</span>.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLowBalanceModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => { setLowBalanceModal(false); navigateWithLoader("/topup"); }}>Top Up</Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
  