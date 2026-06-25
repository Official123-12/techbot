import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getBots } from "@/lib/api";
import type { Bot as BotType } from "@/types";
import { BotCard } from "@/components/BotCard";
import { TechBackground } from "@/components/TechBackground";
import { PageLoader } from "@/components/PageLoader";
import { AppLogoIcon } from "@/components/AppLogo";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  ArrowLeft, Coins, Loader2, Bot, Plus,
  LayoutDashboard, CreditCard, BookOpen, UserCircle, LogOut,
  ChevronRight, Moon, Sun, Menu, X, Shield
} from "lucide-react";

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme(t => t === "dark" ? "light" : "dark") };
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

export function MyBots() {
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const [bots, setBots] = useState<BotType[]>([]);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
    const [botSearch, setBotSearch] = useState("");
    const [deployingAppName, setDeployingAppName] = useState<string | null>(null);
    const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (navOpen) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [navOpen]);

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

    useEffect(() => {
      return () => { if (deployTimerRef.current) clearTimeout(deployTimerRef.current); };
    }, []);

    const fetchBots = useCallback(async () => {
    try {
      const data = await getBots();
      if (Array.isArray(data)) setBots(data);
    } catch { showToast("Failed to load bots", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { if (user) fetchBots(); }, [user, fetchBots]);

  if (authLoading) return <PageLoader />;
  if (!user) return <PageLoader />;

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Top Up TX", icon: CreditCard, path: "/topup" },
    { label: "Docs", icon: BookOpen, path: "/docs" },
  ];

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setNavOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2"><AnimatedLogo /><span className="font-bold text-base">Toxic Host</span></div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-all">
                {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
              </button>
              <button onClick={() => navigateWithLoader("/profile")} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <UserCircle className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {navOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-[110] transform transition-transform duration-300 ease-out ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5"><AnimatedLogo /><span className="font-bold text-base">Toxic Host</span></div>
          <button onClick={() => setNavOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 flex flex-col h-[calc(100%-65px)] overflow-y-auto">
          {user && (
            <div className="mb-5 p-3 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-0.5">Signed in as</p>
              <p className="text-sm font-semibold truncate">{user.username ? `@${user.username}` : user.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-bold text-purple-400">Balance: {user.txCoins} TX</span>
              </div>
            </div>
          )}
          <nav className="space-y-0.5 flex-1">
            {navItems.map(item => (
              <button key={item.path} onClick={() => { navigateWithLoader(item.path); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <div className="flex items-center gap-2.5"><item.icon className="w-4 h-4" />{item.label}</div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
            ))}
            <button onClick={() => { navigateWithLoader("/services/bots"); setNavOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
              <div className="flex items-center gap-2.5"><Bot className="w-4 h-4" />Bot Deployment</div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
            <button onClick={() => { navigateWithLoader("/services/panels"); setNavOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
              <div className="flex items-center gap-2.5"><Shield className="w-4 h-4" />Panels</div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
            {isAdmin && (
              <button onClick={() => { navigateWithLoader("/admin"); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all">
                <div className="flex items-center gap-2.5"><Shield className="w-4 h-4" />Admin Panel</div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
            )}
          </nav>
          <div className="space-y-0.5 border-t border-border pt-3 mt-3">
            <button onClick={() => { navigateWithLoader("/profile"); setNavOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
              <UserCircle className="w-4 h-4" />Profile
            </button>
            <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative z-[1]">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">My Bots</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your deployed bots</p>
          </div>
        </div>

        <div className="mb-4 relative">
            <input
              type="text"
              value={botSearch}
              onChange={e => setBotSearch(e.target.value)}
              placeholder="Search bots by name..."
              className="w-full px-4 py-2.5 pl-10 rounded-lg border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>
            {botSearch && (
              <button onClick={() => setBotSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {deployingAppName && (
            <div className="mb-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-300">Bot is deploying...</p>
                <p className="text-xs text-purple-400/80 mt-0.5">
                  <span className="font-mono">{deployingAppName}</span> is building. This takes about 2 minutes.
                </p>
                <p className="text-xs text-muted-foreground mt-1">Deploying... Your bot is initializing</p>
              </div>
            </div>
          )}

          {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-border flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No bots yet</h3>
            <p className="text-sm text-muted-foreground mb-5">Deploy your first bot to get started</p>
            <Button onClick={() => navigateWithLoader("/services/bots")}>
              <Plus className="w-4 h-4 mr-1" />
              Deploy New
            </Button>
          </div>
        ) : botSearch.trim() && bots.filter(b => b.herokuAppName.toLowerCase().includes(botSearch.toLowerCase())).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No bots match "<span className="text-foreground">{botSearch}</span>"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="mb-4">
              <button
                onClick={() => navigateWithLoader("/services/bots")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-colors"
              >
                <Bot className="w-4 h-4" />
                Deploy More
              </button>
            </div>
            {bots.filter(b => !botSearch.trim() || b.herokuAppName.toLowerCase().includes(botSearch.toLowerCase())).map(bot => (
              <BotCard key={bot._id} bot={bot} onUpdate={fetchBots} coinBalance={user.txCoins} deploying={deployingAppName === bot.herokuAppName} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
