import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getBots, getMyPanels, getPaymentHistory } from "@/lib/api";
import type { Bot as BotType, UserPanel } from "@/types";
import { BotCard } from "@/components/BotCard";
import { CouponModal } from "@/components/CouponModal";
import { ReferralModal } from "@/components/ReferralModal";
import { PageLoader } from "@/components/PageLoader";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  Gift, Users, Coins, LogOut, Shield, Clock,
  Loader2, RefreshCw, Bot, AlertTriangle, Menu, X,
  LayoutDashboard, BookOpen, UserCircle, CreditCard, MessageCircle, ChevronRight,
  Moon, Sun, Server, Youtube
} from "lucide-react";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");
  return { theme, toggle };
}

function AnimatedLogo() {
  return (
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-600 animate-pulse" style={{ animationDuration: "3s" }} />
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-600 opacity-60 blur-sm" />
      <div className="relative w-full h-full flex items-center justify-center rounded-lg">
        <AppLogoIcon className="w-4 h-4 text-white drop-shadow-sm" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, loading: authLoading, logout, isAdmin, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const [bots, setBots] = useState<BotType[]>([]);
  const [panels, setPanels] = useState<UserPanel[]>([]);
  const [transactions, setTransactions] = useState<Array<{_id:string;type:string;txAmount:number;ksAmount:number;status:string;createdAt:string}>>([]);
  const [loading, setLoading] = useState(true);
  const [couponOpen, setCouponOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [deployingAppName, setDeployingAppName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("trial") === "true") {
      setSearchParams({}, { replace: true });
      navigateWithLoader("/deploy?trial=true");
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("deployingBot");
      if (stored) {
        const parsed = JSON.parse(stored) as { appName: string; startTime: number };
        const elapsed = Date.now() - parsed.startTime;
        const remaining = 240000 - elapsed;
        if (remaining > 0) {
          setDeployingAppName(parsed.appName);
          deployTimerRef.current = setTimeout(() => {
            setDeployingAppName(null);
            localStorage.removeItem("deployingBot");
          }, remaining);
        } else {
          localStorage.removeItem("deployingBot");
        }
      }
    } catch {
      localStorage.removeItem("deployingBot");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [botsData, panelsData, txData] = await Promise.all([getBots(), getMyPanels().catch(() => []), getPaymentHistory().catch(() => [])]);
      if (Array.isArray(botsData)) setBots(botsData);
      if (Array.isArray(panelsData)) setPanels(panelsData);
      if (Array.isArray(txData)) setTransactions(txData.slice(0, 8));
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (user) fetchData();
  }, [user, authLoading, navigate, fetchData]);

  useEffect(() => {
    if (navOpen) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [navOpen]);

  useEffect(() => {
    return () => { if (deployTimerRef.current) clearTimeout(deployTimerRef.current); };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshUser()]);
    setRefreshing(false);
  };

  if (authLoading) return <PageLoader />;
  if (!user) return <PageLoader />;

  if (user.isBanned) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Account Suspended</h1>
          <p className="text-muted-foreground max-w-sm">
            Your account has been suspended. You cannot perform any actions on this platform.
            Contact support for assistance.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/contact")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Contact Support
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Top Up", icon: CreditCard, path: "/topup" },
    { label: "Docs", icon: BookOpen, path: "/docs" },
    { label: "Tutorials", icon: Youtube, path: "/tutorials" },
  ];

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setNavOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <AnimatedLogo />
                <span className="font-bold text-base">Stany Host</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-muted transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === "dark"
                  ? <Sun className="w-4 h-4 text-muted-foreground" />
                  : <Moon className="w-4 h-4 text-muted-foreground" />
                }
              </button>
              <button
                onClick={() => navigateWithLoader("/profile")}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Profile"
              >
                <UserCircle className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {navOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-[110] transform transition-transform duration-300 ease-out ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <AnimatedLogo />
            <span className="font-bold text-base">Stany Host</span>
          </div>
          <button onClick={() => setNavOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col h-[calc(100%-65px)] overflow-y-auto">
          {user && (
            <div className="mb-5 p-3 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-0.5">Signed in as</p>
              <p className="text-sm font-semibold truncate">{user.username ? `@${user.username}` : user.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-bold text-purple-400">Balance: {user.txCoins} SQ</span>
              </div>
            </div>
          )}

          <nav className="space-y-0.5 flex-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigateWithLoader(item.path); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
            ))}

            <div className="pt-1.5 pb-1">
              <p className="px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Services</p>
              <button
                onClick={() => { navigateWithLoader("/services/bots"); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4" />
                  Bot Deployment
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
              <button
                onClick={() => { navigateWithLoader("/services/panels"); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4" />
                  Panels
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
            </div>

            <button
              onClick={() => { setReferralOpen(true); setNavOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                Refer & Earn
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
            <button
              onClick={() => { setCouponOpen(true); setNavOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Gift className="w-4 h-4" />
                Coupon Code
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
            {isAdmin && (
              <button
                onClick={() => { navigateWithLoader("/admin"); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
            )}
          </nav>

          <div className="space-y-0.5 border-t border-border pt-3 mt-3">
            <button
              onClick={() => { navigateWithLoader("/contact"); setNavOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Contact Support
            </button>
            <button
              onClick={() => { navigateWithLoader("/profile"); setNavOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <UserCircle className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative z-[1]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {user.username ? (<>Hey, @{user.username} <span className="wave-emoji">👋🏻</span></>) : "Dashboard"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">Welcome back</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigateWithLoader("/topup")} className="hidden sm:flex border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                <CreditCard className="w-4 h-4 mr-1" />
                Top Up
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setReferralOpen(true)} className="hidden sm:flex">
              <Users className="w-4 h-4 mr-1" />
              Refer & Earn
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCouponOpen(true)} className="hidden sm:flex">
              <Gift className="w-4 h-4 mr-1" />
              Coupon
            </Button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-purple-400" : "text-muted-foreground"}`} />
            </button>
          </div>
        </div>

        <div className="flex sm:hidden gap-2 mb-4 flex-wrap">
          {!isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigateWithLoader("/topup")} className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
              <CreditCard className="w-4 h-4 mr-1" />
              Top Up
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setReferralOpen(true)}>
            <Users className="w-4 h-4 mr-1" />
            Refer & Earn
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setCouponOpen(true)}>
            <Gift className="w-4 h-4 mr-1" />
            Coupon
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Coins className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">SQ Balance</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{user.txCoins} SQ</p>
            <button
              onClick={() => navigateWithLoader("/topup")}
              className="mt-2 text-xs text-green-400 hover:underline font-medium"
            >
              Top Up →
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Bots</span>
            </div>
            <p className="text-2xl font-bold">{bots.length}</p>
            <button
              onClick={() => navigateWithLoader("/mybots")}
              className="mt-2 text-xs text-purple-400 hover:underline font-medium"
            >
              Manage Bots →
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Server className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Panels</span>
            </div>
            <p className="text-2xl font-bold">{panels.length}</p>
            <button
              onClick={() => navigateWithLoader("/mypanels")}
              className="mt-2 text-xs text-blue-400 hover:underline font-medium"
            >
              Manage Panels →
            </button>
          </div>
        </div>

        {deployingAppName && (
          <div className="mb-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-purple-300">Bot is deploying...</p>
              <p className="text-xs text-purple-400/80">
                <span className="font-mono">{deployingAppName}</span> is building. This takes about 2 minutes.
              </p>
            </div>
          </div>
        )}

        {bots.filter(b => !b.isTrial && b.status !== "deleted" && b.status !== "expired" && new Date(b.expiresAt).getTime() - Date.now() > 0 && new Date(b.expiresAt).getTime() - Date.now() <= 3 * 24 * 60 * 60 * 1000).map(b => {
            const daysLeft = Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            return (
              <div key={b._id + "-expiry"} className="mb-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/8 flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">Bot expiring soon</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    <span className="font-mono">{b.herokuAppName}</span> expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => navigateWithLoader("/mybots")}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors shrink-0"
                >
                  Renew
                </button>
              </div>
            );
          })}
                  {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
            </div>
          </div>
        ) : bots.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">Recent Bots</h2>
              <button onClick={() => navigateWithLoader("/mybots")} className="text-xs text-purple-400 hover:underline font-medium">
                View all →
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {bots.slice(0, 4).map(bot => (
                <BotCard
                  key={bot._id}
                  bot={bot}
                  onUpdate={fetchData}
                  deploying={deployingAppName === bot.herokuAppName}
                  coinBalance={user.txCoins}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-6 mb-2 space-y-2">
          <button
            onClick={() => navigateWithLoader("/contact")}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Contact Support</p>
                <p className="text-xs text-muted-foreground">Get help via WhatsApp or Telegram</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          <button
            onClick={() => navigateWithLoader("/tutorials")}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
                <Youtube className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Video Tutorials</p>
                <p className="text-xs text-muted-foreground">Watch step-by-step guides</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>

        {transactions.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Recent Activity
                </h2>
                <span className="text-xs text-muted-foreground">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="rounded-xl border border-border/60 overflow-hidden bg-card/30">
                {transactions.map((t, i) => {
                  const isCredit = t.type === "admin_grant" || t.type === "topup" || t.type === "refund";
                  const isFailed = t.status === "failed";
                  const isPending = t.status === "pending";
                  const labelMap: Record<string, string> = { topup: "Top Up", deploy: "Bot Deployed", renew: "Bot Renewed", admin_grant: "SQ Granted", refund: "Refund", panel: "Panel Purchase" };
                  const label = labelMap[t.type] ?? t.type.replace(/_/g, " ");
                  const sub = t.type === "topup" && t.ksAmount > 0 ? `TSh ${t.ksAmount}` : t.type === "deploy" || t.type === "renew" ? "spent" : t.type === "admin_grant" ? "admin bonus" : "";
                  const iconEl = t.type === "deploy" || t.type === "renew"
                    ? <Bot className="w-3.5 h-3.5 text-violet-400" />
                    : t.type === "topup"
                    ? <CreditCard className="w-3.5 h-3.5 text-green-400" />
                    : t.type === "panel"
                    ? <Server className="w-3.5 h-3.5 text-purple-400" />
                    : <Coins className={`w-3.5 h-3.5 ${isCredit ? "text-amber-400" : "text-muted-foreground"}`} />;
                  return (
                    <div
                      key={t._id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors ${i < transactions.length - 1 ? "border-b border-border/40" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isFailed ? "bg-muted/60" : isCredit ? "bg-green-500/10" : "bg-violet-500/10"}`}>
                          {iconEl}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate capitalize">{label}</p>
                          <p className="text-xs text-muted-foreground truncate">{sub ? `${sub} · ` : ""}{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                        <span className={`text-sm font-bold tabular-nums ${isFailed ? "text-muted-foreground line-through" : isCredit ? "text-green-400" : "text-red-400"}`}>
                          {isCredit ? "+" : "-"}{Math.abs(t.txAmount)} SQ
                        </span>
                        {isPending && <span className="text-[10px] font-medium text-yellow-500">pending</span>}
                        {isFailed && <span className="text-[10px] font-medium text-red-500">failed</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </main>

      <CouponModal isOpen={couponOpen} onClose={() => setCouponOpen(false)} onSuccess={() => { fetchData(); refreshUser(); }} />

      <ReferralModal
        isOpen={referralOpen}
        onClose={() => setReferralOpen(false)}
        referralCode={user.referralCode || ""}
      />
    </div>
  );
}