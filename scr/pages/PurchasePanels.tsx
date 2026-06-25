import { useState, useEffect } from "react";
  import { useNavigate } from "react-router";
  import { Button } from "@/components/ui/button";
  import { useAuth } from "@/hooks/useAuth";
  import { useToast } from "@/hooks/useToast";
  import { useNavLoader } from "@/App";
  import { getPanelPlans, purchasePanel, purchaseAdminPanel } from "@/lib/api";
  import type { PanelPlan } from "@/types";
  import { TechBackground } from "@/components/TechBackground";
  import { PageLoader } from "@/components/PageLoader";
  import { AppLogoIcon } from "@/components/AppLogo";
  import { Modal } from "@/components/Modal";
  import { lockScroll, unlockScroll } from "@/lib/scrollLock";
  import {
    ArrowLeft, Coins, Loader2, Shield, Server,
    LayoutDashboard, CreditCard, BookOpen, UserCircle, LogOut,
    ChevronRight, Moon, Sun, Menu, X, Bot, Check, Star, Crown, Zap
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

  export function PurchasePanels() {
    const { user, loading: authLoading, logout, isAdmin, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { navigateWithLoader } = useNavLoader();
    const { showToast } = useToast();
    const { theme, toggle: toggleTheme } = useTheme();
    const [plans, setPlans] = useState<PanelPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [navOpen, setNavOpen] = useState(false);
    const [buyModal, setBuyModal] = useState<PanelPlan | null>(null);
    const [buying, setBuying] = useState(false);
    const [purchasedPlan, setPurchasedPlan] = useState<{ username: string; password: string; loginUrl: string } | null>(null);
    const [adminBuying, setAdminBuying] = useState(false);
    const [adminModal, setAdminModal] = useState(false);

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
      if (purchasedPlan) {
        lockScroll();
        return () => unlockScroll();
      }
    }, [purchasedPlan]);

    useEffect(() => {
      if (!user) return;
      getPanelPlans()
        .then(data => { if (Array.isArray(data)) setPlans(data); })
        .catch(() => showToast("Failed to load panel plans", "error"))
        .finally(() => setLoading(false));
    }, [user]);

    if (authLoading) return <PageLoader />;
    if (!user) return <PageLoader />;

    const handleBuy = async () => {
      if (!buyModal) return;
      if (user.txCoins < buyModal.txCost) {
        showToast("Insufficient TX — please top up", "error");
        setBuyModal(null);
        navigateWithLoader("/topup");
        return;
      }
      setBuying(true);
      try {
        const res = await purchasePanel(buyModal._id) as { success?: boolean; error?: string; code?: string; panel?: { panelUsername: string; panelPassword: string; panelLoginUrl: string } };
        if (res.success) {
          if (res.panel) {
            setPurchasedPlan({
              username: res.panel.panelUsername,
              password: res.panel.panelPassword,
              loginUrl: res.panel.panelLoginUrl,
            });
          }
          showToast("Panel purchased!", "success");
          setBuyModal(null);
          await refreshUser();
        } else if (res.code === "INSUFFICIENT_COINS") {
          showToast("Insufficient TX — redirecting to Top Up", "error");
          setBuyModal(null);
          navigateWithLoader("/topup");
        } else {
          showToast(res.error || "Purchase failed", "error");
        }
      } catch { showToast("Purchase failed", "error"); }
      finally { setBuying(false); }
    };

    const handleBuyAdmin = async () => {
      if (user.txCoins < 40) {
        showToast("Insufficient TX — please top up", "error");
        setAdminModal(false);
        navigateWithLoader("/topup");
        return;
      }
      setAdminBuying(true);
      try {
        const res = await purchaseAdminPanel() as { success?: boolean; error?: string; code?: string; panel?: { panelUsername: string; panelPassword: string; panelLoginUrl: string } };
        if (res.success) {
          if (res.panel) {
            setPurchasedPlan({ username: res.panel.panelUsername, password: res.panel.panelPassword, loginUrl: res.panel.panelLoginUrl });
          }
          showToast("Admin access granted!", "success");
          setAdminModal(false);
          await refreshUser();
        } else if (res.code === "INSUFFICIENT_COINS") {
          showToast("Insufficient TX — redirecting to Top Up", "error");
          setAdminModal(false);
          navigateWithLoader("/topup");
        } else {
          showToast(res.error || "Purchase failed", "error");
        }
      } catch { showToast("Purchase failed", "error"); }
      finally { setAdminBuying(false); }
    };

    const navItems = [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Top Up TX", icon: CreditCard, path: "/topup" },
      { label: "Docs", icon: BookOpen, path: "/docs" },
    ];

    return (
      <div className="min-h-screen bg-background relative">
        <TechBackground />

        {purchasedPlan && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-7 h-7 text-green-400" />
                </div>
                <h2 className="text-lg font-bold mb-1">Panel Ready!</h2>
                <p className="text-sm text-muted-foreground">Your panel credentials are below. Save them securely.</p>
              </div>
              <div className="space-y-2 bg-muted/50 rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Username</span>
                  <span className="font-mono font-semibold text-xs">{purchasedPlan.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Password</span>
                  <span className="font-mono font-semibold text-xs">{purchasedPlan.password}</span>
                </div>
              </div>
              <a href={purchasedPlan.loginUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
                Open Panel
              </a>
              <button onClick={() => setPurchasedPlan(null)}
                className="w-full h-9 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
            </div>
          </div>
        )}

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
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium bg-muted text-foreground transition-all">
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
              <h1 className="text-2xl font-bold">Purchase Panels</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Choose a game server panel plan</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20">
              <Server className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No panel plans available right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => (
                <div key={plan._id} className={`relative rounded-xl border bg-card p-5 flex flex-col ${plan.isBestDeal ? "border-purple-500/40 ring-1 ring-purple-500/20" : "border-border"}`}>
                  {plan.isBestDeal && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-semibold">
                        <Star className="w-2.5 h-2.5" />BEST DEAL
                      </span>
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="font-bold text-base">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  <div className="space-y-1.5 mb-5 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">RAM</span>
                      <span className="font-medium">{plan.ram}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Disk</span>
                      <span className="font-medium">{plan.disk}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">CPU</span>
                      <span className="font-medium">{plan.cpu}</span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-extrabold text-purple-400">{plan.txCost} TX</span>
                      {plan.originalTxCost > plan.txCost && (
                        <span className="text-xs text-muted-foreground line-through">{plan.originalTxCost} TX</span>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => user.txCoins < plan.txCost ? navigateWithLoader("/topup") : setBuyModal(plan)}
                  >
                    {user.txCoins < plan.txCost ? "Top Up" : "Purchase"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 p-5 pt-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <span className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[10px] font-bold shadow-lg shadow-amber-500/30">
                  <Crown className="w-2.5 h-2.5" />ADMIN ACCESS
                </span>
              </div>
              <div className="flex items-start gap-4 mt-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base text-amber-300">Admin Panel Access</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Full administrator privileges on the Pterodactyl panel</p>
                  <div className="mt-2 space-y-1">
                    {["Manage all servers & users", "Access node & allocation controls", "Full panel dashboard access"].map(f => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-amber-200/80">
                        <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-2xl font-extrabold text-amber-400">40 TX</span>
                  <span className="text-xs text-muted-foreground ml-2">one-time</span>
                </div>
                <Button
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold border-0 shadow-lg shadow-amber-500/20"
                  onClick={() => user.txCoins < 40 ? navigateWithLoader("/topup") : setAdminModal(true)}
                >
                  {user.txCoins < 40 ? "Top Up" : "Purchase"}
                </Button>
              </div>
            </div>
          </div>
        </main>

        <Modal isOpen={!!buyModal} onClose={() => setBuyModal(null)} title="Confirm Purchase" maxWidth="max-w-sm">
          {buyModal && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/50 border border-border text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-semibold">{buyModal.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="font-bold text-purple-400">{buyModal.txCost} TX</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Your balance</span><span className="font-semibold">{user.txCoins} TX</span></div>
              </div>
              <p className="text-xs text-muted-foreground">After purchase your credentials will be shown once. Save them securely.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBuyModal(null)} disabled={buying}>Cancel</Button>
                <Button className="flex-1" onClick={handleBuy} disabled={buying}>
                  {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal isOpen={adminModal} onClose={() => setAdminModal(false)} title="Confirm Admin Purchase" maxWidth="max-w-sm">
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-semibold text-amber-300">Admin Panel Access</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="font-bold text-amber-400">40 TX</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Your balance</span><span className="font-semibold">{user?.txCoins} TX</span></div>
            </div>
            <p className="text-xs text-muted-foreground">You will receive full admin credentials. Save them immediately after purchase — they are shown only once.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdminModal(false)} disabled={adminBuying}>Cancel</Button>
              <Button
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold border-0"
                onClick={handleBuyAdmin}
                disabled={adminBuying}
              >
                {adminBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
  