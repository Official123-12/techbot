import { useState, useEffect } from "react";
  import { useNavigate } from "react-router";
  import { useAuth } from "@/hooks/useAuth";
  import { useNavLoader } from "@/App";
  import { TechBackground } from "@/components/TechBackground";
  import { PageLoader } from "@/components/PageLoader";
  import { AppLogoIcon } from "@/components/AppLogo";
  import { lockScroll, unlockScroll } from "@/lib/scrollLock";
  import {
    ArrowLeft, Coins, Youtube, Mail, MessageCircle,
    LayoutDashboard, CreditCard, BookOpen, UserCircle, LogOut,
    Bot, Shield, ChevronRight, Moon, Sun, Menu, X, ExternalLink
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

  export function Contact() {
    const { user, loading: authLoading, logout, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { navigateWithLoader } = useNavLoader();
    const { theme, toggle: toggleTheme } = useTheme();
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

    if (authLoading) return <PageLoader />;
    if (!user) return <PageLoader />;

    const navItems = [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Top Up TX", icon: CreditCard, path: "/topup" },
      { label: "Docs", icon: BookOpen, path: "/docs" },
      { label: "Tutorials", icon: Youtube, path: "/tutorials" },
    ];

    const contacts = [
      {
        label: "WhatsApp",
        handle: "+255 787 069 502",
        description: "Chat with us on WhatsApp for fast support",
        href: "https://wa.me/255620490076",
        icon: (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        ),
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
        hoverBg: "hover:bg-green-500/15",
        btnBg: "bg-green-500/15 hover:bg-green-500/25 text-green-400 border-green-500/30",
      },
      {
        label: "WhatsApp Channel",
        handle: "Stany Host Updates",
        description: "Join our WhatsApp channel for news and updates",
        href: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
        icon: (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        ),
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
        hoverBg: "hover:bg-green-500/15",
        btnBg: "bg-green-500/15 hover:bg-green-500/25 text-green-400 border-green-500/30",
      },
      {
        label: "Telegram",
        handle: "@Stanytz076",
        description: "Contact us via Telegram",
        href: "https://t.me/Stanytz076",
        icon: (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        ),
        color: "text-sky-400",
        bg: "bg-sky-500/10",
        border: "border-sky-500/20",
        hoverBg: "hover:bg-sky-500/15",
        btnBg: "bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border-sky-500/30",
      },
      {
        label: "Email",
        handle: "stanytz953@gmail.com",
        description: "Send us an email for detailed inquiries",
        href: "mailto:stanytz953@gmail.com",
        icon: <Mail className="w-6 h-6" />,
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        border: "border-violet-500/20",
        hoverBg: "hover:bg-violet-500/15",
        btnBg: "bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border-violet-500/30",
      },
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
                  <span className="text-sm font-bold text-purple-400">Balance: {user.txCoins} SQ</span>
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
                <MessageCircle className="w-6 h-6 text-purple-400" />
                Contact Support
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Reach us through any of the channels below</p>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="space-y-3">
              {contacts.map(c => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className={`flex items-center gap-4 p-5 rounded-xl border ${c.border} ${c.bg} ${c.hoverBg} transition-all group`}
                >
                  <div className={`w-12 h-12 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0 ${c.color}`}>
                    {c.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${c.color}`}>{c.label}</p>
                    <p className="text-base font-bold truncate">{c.handle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                </a>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-xl border border-border bg-muted/20">
              <p className="text-sm text-muted-foreground text-center">
                Our support team typically responds within <span className="text-foreground font-medium">a few hours</span>.
                For urgent issues, WhatsApp is the fastest channel.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }
