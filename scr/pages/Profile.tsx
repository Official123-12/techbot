import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/PageLoader";
import { useNavLoader } from "@/App";
import { updateUsername } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { TechBackground } from "@/components/TechBackground";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  ArrowLeft, UserCircle, Mail, Coins, LogOut,
  Shield, Copy, Check, Pencil, X, Palette
} from "lucide-react";

type AccentColor = "violet" | "red" | "blue" | "green" | "orange" | "pink" | "teal" | "yellow" | "rose" | "indigo" | "cyan" | "amber";

const ACCENT_OPTIONS: { key: AccentColor; label: string; color: string; hsl: string }[] = [
  { key: "violet", label: "Violet",  color: "#8b5cf6", hsl: "262 83% 58%" },
  { key: "indigo", label: "Indigo",  color: "#6366f1", hsl: "239 84% 67%" },
  { key: "blue",   label: "Blue",    color: "#3b82f6", hsl: "217 91% 60%" },
  { key: "cyan",   label: "Cyan",    color: "#06b6d4", hsl: "192 91% 44%" },
  { key: "teal",   label: "Teal",    color: "#14b8a6", hsl: "173 80% 40%" },
  { key: "green",  label: "Green",   color: "#22c55e", hsl: "142 71% 45%" },
  { key: "yellow", label: "Yellow",  color: "#eab308", hsl: "48 96% 53%" },
  { key: "amber",  label: "Amber",   color: "#f59e0b", hsl: "38 92% 50%" },
  { key: "orange", label: "Orange",  color: "#f97316", hsl: "25 95% 53%" },
  { key: "red",    label: "Red",     color: "#ef4444", hsl: "0 72% 51%" },
  { key: "rose",   label: "Rose",    color: "#f43f5e", hsl: "347 77% 50%" },
  { key: "pink",   label: "Pink",    color: "#ec4899", hsl: "330 81% 60%" },
];

function applyAccent(accent: AccentColor) {
  const found = ACCENT_OPTIONS.find(a => a.key === accent);
  if (!found) return;
  let styleEl = document.getElementById("__accent_override__") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "__accent_override__";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `:root, .dark { --primary: ${found.hsl}; --ring: ${found.hsl}; }`;
  localStorage.setItem("accent", accent);
}

function useAccent() {
  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem("accent") as AccentColor) || "violet";
  });
  useEffect(() => { applyAccent(accent); }, [accent]);
  const setAccent = (a: AccentColor) => { setAccentState(a); applyAccent(a); };
  return { accent, setAccent };
}

export function initStoredAccent() {
  const accent = (localStorage.getItem("accent") as AccentColor) || "violet";
  applyAccent(accent);
}

export function Profile() {
  const { user, loading: authLoading, logout, isAdmin, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { accent, setAccent } = useAccent();
  const { showToast } = useToast();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (themePickerOpen) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [themePickerOpen]);

  const copyText = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {}
  };

  const handleSaveUsername = async () => {
    const u = newUsername.trim();
    if (!u || u.length < 3) { showToast("Username must be at least 3 characters", "error"); return; }
    setSavingUsername(true);
    try {
      const res = await updateUsername(u) as { success?: boolean; username?: string; error?: string };
      if (res.success) {
        showToast("Username updated!", "success");
        setEditingUsername(false);
        setNewUsername("");
        refreshUser();
      } else {
        showToast(res.error || "Failed to update username", "error");
      }
    } catch {
      showToast("Failed to update username", "error");
    } finally {
      setSavingUsername(false);
    }
  };

  if (authLoading) return <PageLoader />;
  if (!user) return <PageLoader />;

  const referralUrl = `${window.location.origin}/signup?ref=${user.referralCode || ""}`;
  const currentAccent = ACCENT_OPTIONS.find(a => a.key === accent) || ACCENT_OPTIONS[0];

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-xl mx-auto px-4">
          <div className="flex items-center h-14 gap-3">
            <button
              onClick={() => navigateWithLoader("/")}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-base">Profile</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4 relative z-[1]">
        <div className="rounded-xl bg-card border border-border p-6 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <UserCircle className="w-10 h-10 text-purple-400" />
          </div>

          {editingUsername ? (
            <div className="w-full max-w-xs space-y-2">
              <Input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="new_username"
                maxLength={20}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleSaveUsername} disabled={savingUsername}>
                  {savingUsername ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingUsername(false); setNewUsername(""); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Letters, numbers, underscores only</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-xl font-bold">
                  {user.username ? `@${user.username}` : "No username set"}
                </h2>
                <button
                  onClick={() => { setNewUsername(user.username || ""); setEditingUsername(true); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title="Edit username"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
              {!user.username && (
                <button
                  onClick={() => setEditingUsername(true)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  + Set a username
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" /> Administrator
            </span>
          )}
        </div>

        <div className="rounded-xl bg-card border border-border divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Coins className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TX Balance</p>
                <p className="text-lg font-bold text-purple-400">{user.txCoins} TX</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigateWithLoader("/topup")} className="bg-purple-600 hover:bg-purple-700 text-white">
              Top Up
            </Button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Mail className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate max-w-[200px]">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => copyText(user.email, setCopiedEmail)}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              {copiedEmail ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {user.referralCode && (
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <UserCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Referral Link</p>
                  <p className="text-sm font-mono truncate">{referralUrl}</p>
                </div>
              </div>
              <button
                onClick={() => copyText(referralUrl, setCopiedRef)}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0 ml-2"
              >
                {copiedRef ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-card border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Settings</h3>
          </div>
          <div className="divide-y divide-border">
            <div className="p-4 flex items-center justify-between" data-theme-picker>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Color Theme</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentAccent.label}</p>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setThemePickerOpen(o => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: currentAccent.color }}
                  />
                  <span className="text-sm">{currentAccent.label}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${themePickerOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {themePickerOpen && createPortal(
                  <div
                    className="fixed inset-0 z-[600] flex items-center justify-center p-4"
                    onClick={() => setThemePickerOpen(false)}
                  >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                      className="relative bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                      style={{ width: "13rem", maxHeight: "70vh", overflowY: "auto" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold">Color Theme</p>
                      </div>
                      {ACCENT_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => { setAccent(opt.key); setThemePickerOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm ${accent === opt.key ? "bg-muted/60" : ""}`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: opt.color, borderColor: accent === opt.key ? "white" : "transparent" }}
                          >
                            {accent === opt.key && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => navigateWithLoader("/admin")}
                className="w-full p-4 flex items-center justify-between hover:bg-amber-500/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-amber-400">Admin Panel</p>
                </div>
              </button>
            )}

            <button
              onClick={logout}
              className="w-full p-4 flex items-center gap-3 hover:bg-red-500/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <LogOut className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-sm font-medium text-red-400">Sign Out</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
