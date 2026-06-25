import { useState, useEffect } from "react";
    import { useNavigate } from "react-router";
    import { Button } from "@/components/ui/button";
    import { Input } from "@/components/ui/input";
    import { Label } from "@/components/ui/label";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { deployBot } from "@/lib/api";
    import { useToast } from "@/hooks/useToast";
    import { Loader2, ExternalLink, Sparkles, Check, CreditCard, Smartphone, Apple } from "lucide-react";

    interface DeployFormProps {
      onDeploy: (appName?: string) => void;
      coinBalance: number;
      initialTrial?: boolean;
    }

    function cleanPhoneNumber(phone: string): string {
      return phone.replace(/[^0-9]/g, "");
    }

    function hasCountryCode(phone: string): boolean {
      const cleaned = cleanPhoneNumber(phone);
      return cleaned.length >= 10 && !cleaned.startsWith("0");
    }

    const DEPLOY_COST = 10;

    export function DeployForm({ onDeploy, coinBalance, initialTrial = false }: DeployFormProps) {
      const [phoneNumber, setPhoneNumber] = useState("");
      const [sessionVar, setSessionVar] = useState("");
      const [device, setDevice] = useState("android");
      const [isTrial, setIsTrial] = useState(initialTrial);
      const [loading, setLoading] = useState(false);
      const { showToast } = useToast();
      const navigate = useNavigate();

      useEffect(() => {
        setIsTrial(initialTrial);
      }, [initialTrial]);

      const insufficientBalance = !isTrial && coinBalance < DEPLOY_COST;

      const handleSubmit = async () => {
        if (insufficientBalance) {
          navigate("/topup");
          return;
        }
        const cleaned = cleanPhoneNumber(phoneNumber);
        if (cleaned.length < 10) {
          showToast("Phone number must be at least 10 digits", "error");
          return;
        }
        if (!hasCountryCode(phoneNumber)) {
          showToast("Phone number must include a country code (e.g. 254123456789)", "error");
          return;
        }
        if (!sessionVar.trim()) {
          showToast("Session ID is required", "error");
          return;
        }
        setLoading(true);
        try {
          const res = await deployBot({
            phoneNumber: cleaned,
            sessionVar: sessionVar.trim(),
            isTrial,
            device,
            months: 1
          });
          if (res.success) {
            showToast(isTrial ? "Trial bot deployed!" : "Bot deployed! Building in ~2 minutes...", "success");
            const appName = res.bot?.herokuAppName || `txhost-${cleaned}`;
            setPhoneNumber("");
            setSessionVar("");
            onDeploy(appName);
          } else {
            if (res.code === "INSUFFICIENT_COINS") {
              showToast("Insufficient TX Coins — redirecting to Top Up", "error");
              navigate("/topup");
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
        <div className="space-y-4">
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
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500 text-white leading-none shrink-0">
                  FREE
                </span>
              </div>
              <p className="text-xs mt-0.5 text-purple-300/80">No TX coins required · One-time per number · Available now!</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${isTrial ? "bg-purple-500 border-purple-500" : "border-purple-500/50"}`}>
              {isTrial && <Check className="w-3 h-3 text-white" />}
            </div>
          </button>

          <div>
            <Label htmlFor="phone">WhatsApp Number</Label>
            <Input
              id="phone"
              placeholder="254123456789"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9\s]/g, ""))}
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground mt-1">Country code + digits only (e.g. 254123456789)</p>
          </div>

          <div>
            <Label htmlFor="session">Session ID</Label>
            <Input
              id="session"
              placeholder="Paste your session string here"
              value={sessionVar}
              onChange={e => setSessionVar(e.target.value)}
            />
            <a
              href="https://toxicx.tech/pairing"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 hover:underline transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Get Session ID at toxicx.tech/pairing
            </a>
          </div>

          <div>
            <Label>Device Mode</Label>
            <Select value={device} onValueChange={setDevice}>
              <SelectTrigger className="w-full h-10 mt-1">
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
            <div className={`mt-2 p-2.5 rounded-lg border text-xs ${device === "android" ? "bg-green-500/8 border-green-500/20 text-green-300" : "bg-blue-500/8 border-blue-500/20 text-blue-300"}`}>
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

          {!isTrial && (
            <div className={`p-3 rounded-lg border text-sm transition-all ${
              insufficientBalance
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}>
              <div className="flex justify-between items-center">
                <span>Cost (1 month)</span>
                <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-foreground"}`}>{DEPLOY_COST} TX</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span>Your balance</span>
                <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-purple-400"}`}>{coinBalance} TX</span>
              </div>
              {insufficientBalance && (
                <p className="text-xs mt-2 text-red-400">You need {DEPLOY_COST - coinBalance} more TX to deploy.</p>
              )}
            </div>
          )}

          <Button
            className={`w-full ${insufficientBalance ? "opacity-70" : ""}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : insufficientBalance ? (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Top Up — Insufficient Balance
              </>
            ) : (
              isTrial ? "Deploy Free Trial" : `Deploy Bot — ${DEPLOY_COST} TX / month`
            )}
          </Button>
        </div>
      );
    }