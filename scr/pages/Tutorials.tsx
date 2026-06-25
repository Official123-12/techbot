import { useEffect, useState } from "react";
  import { useNavigate } from "react-router";
  import { useAuth } from "@/hooks/useAuth";
  import { useNavLoader } from "@/App";
  import { getTutorials } from "@/lib/api";
  import { TechBackground } from "@/components/TechBackground";
  import { PageLoader } from "@/components/PageLoader";
  import { AppLogoIcon } from "@/components/AppLogo";
  import { lockScroll, unlockScroll } from "@/lib/scrollLock";
  import type { Tutorial } from "@/types";
  import {
    ArrowLeft, Coins, Youtube, ExternalLink,
    LayoutDashboard, CreditCard, BookOpen, UserCircle, LogOut,
    Bot, Shield, ChevronRight, Moon, Sun, Menu, X, PlayCircle
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

  function getYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? match[1] : null;
  }

  function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
    const videoId = getYoutubeId(tutorial.youtubeUrl);
    const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

    return (
      <a
        href={tutorial.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-red-500/40 transition-all hover:shadow-lg hover:shadow-red-500/5"
      >
        <div className="relative aspect-video bg-muted overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt={tutorial.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Youtube className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl">
              <PlayCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="absolute top-2 right-2 bg-red-600 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Youtube className="w-3 h-3 text-white" />
            <span className="text-white text-[10px] font-bold">YouTube</span>
          </div>
        </div>
        <div className="p-4 flex items-center justify-between gap-2">
          <p className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{tutorial.title}</p>
          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-red-400 transition-colors" />
        </div>
      </a>
    );
  }

  export function Tutorials() {
    const { user, loading: authLoading, logout, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { navigateWithLoader } = useNavLoader();
    const { theme, toggle: toggleTheme } = useTheme();
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
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
      getTutorials()
        .then(data => { if (Array.isArray(data)) setTutorials(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []);

    if (authLoading) return <PageLoader />;
    if (!user) return <PageLoader />;

    const navItems = [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Top Up TX", icon: CreditCard, path: "/topup" },
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
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Youtube className="w-6 h-6 text-red-500" />
                Tutorials
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Learn how to use Toxic Host</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : tutorials.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Youtube className="w-8 h-8 text-red-400/60" />
              </div>
              <h3 className="text-lg font-medium mb-1">No tutorials available currently</h3>
              <p className="text-sm text-muted-foreground">Check back soon — tutorials will be added here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tutorials.map(t => (
                <TutorialCard key={t._id} tutorial={t} />
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }
  