import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getBotTemplates } from "@/lib/api";
import type { BotTemplate } from "@/types";
import { TechBackground } from "@/components/TechBackground";
import { PageLoader } from "@/components/PageLoader";
import { AppLogoIcon } from "@/components/AppLogo";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  ArrowLeft, Coins, Loader2, Sparkles, ExternalLink,
  LayoutDashboard, CreditCard, BookOpen, UserCircle, LogOut,
  Shield, ChevronRight, Moon, Sun, Menu, X, Bot, Copy, Check
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

function CopyShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const url = `${origin}/services/bots/${slug}`;
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copy shareable link"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

export function ServicesBots() {
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);

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
    if (!user) return;
    getBotTemplates()
      .then(data => { if (Array.isArray(data)) setTemplates(data); })
      .catch(() => showToast("Failed to load bots", "error"))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  if (authLoading) return <PageLoader />;
  if (!user) return <PageLoader />;

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Top Up TX", icon: CreditCard, path: "/topup" },
    { label: "Docs", icon: BookOpen, path: "/docs" },
  ];

  const handleDeploy = (template: BotTemplate) => {
    if (template.isDefault) {
      navigateWithLoader("/deploy");
    } else {
      navigateWithLoader(`/services/bots/${template.shareableSlug}`);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setNavOpen(true)} aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <AnimatedLogo />
                <span className="font-bold text-base">Toxic Host</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-all duration-200" aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
              </button>
              <button onClick={() => navigateWithLoader("/profile")} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Profile">
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
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium bg-muted text-foreground transition-all">
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
            <h1 className="text-2xl font-bold">Bot Deployment</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Choose a bot to deploy</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <div key={template._id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-purple-500/30 transition-all duration-200 flex flex-col">
                <div className="aspect-video bg-muted/40 overflow-hidden relative">
                  {template.imageUrl ? (
                    <img src={template.imageUrl} alt={template.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Bot className="w-12 h-12 text-muted-foreground/40" />
                    </div>
                  )}
                  {template.isDefault && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-purple-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      Free Trial Available
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-base mb-1">{template.name}</h3>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Coins className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-sm text-purple-400 font-medium">
                      {template.isDefault ? "10 TX / month" : `${template.costTx} TX / month`}
                    </span>
                  </div>
                  <div className="mt-auto space-y-2">
                    <Button className="w-full" size="sm" onClick={() => handleDeploy(template)}>
                      Deploy
                    </Button>
                    <div className="flex items-center justify-between">
                      <CopyShareLink slug={template.shareableSlug} />
                      <a href={template.githubRepo} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
