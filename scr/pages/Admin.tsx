import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  getAdminStats, getAdminUsers, getAdminBots, getAdminTransactions,
  getAdminCoupons, getAdminReferrals, deleteAllAdminReferrals,
  banUser, unbanUser, grantTx, subtractTx, deleteUser, resetPassword,
  stopAdminBot, startAdminBot, restartAdminBot, deleteAdminBot,
  createCoupon, deleteCoupon,
  getAdminTeams, createAdminTeam, updateAdminTeam, deleteAdminTeam,
  getAdminDbStats, purgeAdminCollection, getAdminBotLogs,
  getBotTemplates, addBotTemplate, deleteBotTemplate,
  getAdminPanelPlans, createAdminPanelPlan, deleteAdminPanelPlan,
  getAdminPanels, deleteAdminPanel,
  deleteAdminTransaction, deleteAdminTransactionsBulk, resolveStaleTransactions,
  getAdminTutorials, createAdminTutorial, deleteAdminTutorial,
  getOrphanHerokuApps,
  deleteOrphanApp
} from "@/lib/api";
import type { AdminStats, AdminUser, AdminBot, Transaction, Coupon, Referral, HerokuTeam, DbStats, DbCollectionStat, BotTemplate, PanelPlan } from "@/types";
import { PageLoader } from "@/components/PageLoader";
import { Modal } from "@/components/Modal";
import { LogViewer } from "@/components/LogViewer";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  Users, Bot, Coins, CreditCard, ShoppingBag,
  Ban, CheckCircle, Loader2, RefreshCw, Trash2, ArrowLeft,
  Play, Square, RotateCcw, Plus, Gift, UsersRound, Crown,
  Menu, X, LayoutDashboard, Search, Settings2, Minus,
  AlertCircle, ChevronDown, ChevronUp, Power, PowerOff, Database, FileText, Server,
  Youtube, Clock
} from "lucide-react";

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface AdminPanel { _id: string; planName: string; panelUsername: string; panelLoginUrl: string; purchasedAt: string; ownerEmail: string; ownerUsername: string; txCost: number; }

  type TabKey = "overview" | "users" | "bots" | "transactions" | "coupons" | "referrals" | "config" | "database" | "bot-templates" | "panel-plans" | "panels" | "tutorials";

const NAV_ITEMS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview",       label: "Overview",       icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "users",          label: "Users",          icon: <Users className="w-4 h-4" /> },
  { key: "bots",           label: "Bots",           icon: <Bot className="w-4 h-4" /> },
  { key: "transactions",   label: "Transactions",   icon: <CreditCard className="w-4 h-4" /> },
  { key: "coupons",        label: "Coupons",        icon: <Gift className="w-4 h-4" /> },
  { key: "referrals",      label: "Referrals",      icon: <UsersRound className="w-4 h-4" /> },
  { key: "bot-templates",  label: "Bot Templates",  icon: <Bot className="w-4 h-4" /> },
  { key: "panel-plans",    label: "Panel Plans",    icon: <Server className="w-4 h-4" /> },
  { key: "panels",         label: "Panels",         icon: <Server className="w-4 h-4" /> },
  { key: "tutorials",      label: "Tutorials",      icon: <Youtube className="w-4 h-4" /> },
  { key: "config",         label: "Config",         icon: <Settings2 className="w-4 h-4" /> },
  { key: "database",       label: "Database",       icon: <Database className="w-4 h-4" /> },
];

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</span>
          <div className="text-muted-foreground opacity-60">{icon}</div>
        </div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

export function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [bots, setBots] = useState<AdminBot[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [teams, setTeams] = useState<HerokuTeam[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [botTemplates, setBotTemplates] = useState<BotTemplate[]>([]);
  const [panelPlans, setPanelPlans] = useState<PanelPlan[]>([]);
  const [adminPanels, setAdminPanels] = useState<AdminPanel[]>([]);
  const [tutorials, setTutorials] = useState<{ _id: string; title: string; youtubeUrl: string; order: number }[]>([]);
  const [newTutorialTitle, setNewTutorialTitle] = useState("");
  const [newTutorialUrl, setNewTutorialUrl] = useState("");
  const [newTutorialOrder, setNewTutorialOrder] = useState(0);
  const [tutorialLoading, setTutorialLoading] = useState(false);
    const [deletePanelModal, setDeletePanelModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [newTemplate, setNewTemplate] = useState({ name: "", githubRepo: "", sessionIdUrl: "", costTx: "10" });
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [newPlan, setNewPlan] = useState({ name: "", description: "", txCost: "20", ram: "512MB", disk: "2GB", cpu: "1", isBestDeal: false });
  const [addingPlan, setAddingPlan] = useState(false);
  const [deletePlanModal, setDeletePlanModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
    const [purgeModal, setPurgeModal] = useState<{ open: boolean; collection: string; label: string }>({ open: false, collection: "", label: "" });
    const [purging, setPurging] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [userSearch, setUserSearch] = useState("");
    const [botSearch, setBotSearch] = useState("");
    const [adminLogsOpen, setAdminLogsOpen] = useState(false);
    const [adminLogs, setAdminLogs] = useState<string[]>([]);
    const [adminLogsBot, setAdminLogsBot] = useState<string>("");
    const [adminLogsRefreshing, setAdminLogsRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userPanelOpen, setUserPanelOpen] = useState(false);

  const [banReason, setBanReason] = useState("");
  const [banModalOpen, setBanModalOpen] = useState(false);

  const [txAmount, setTxAmount] = useState("");
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [subtractTxModalOpen, setSubtractTxModalOpen] = useState(false);
  const [subtractAmount, setSubtractAmount] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [pwModalOpen, setPwModalOpen] = useState(false);

  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponTx, setCouponTx] = useState("");
  const [deleteCouponModal, setDeleteCouponModal] = useState<{ open: boolean; id: string; code: string }>({ open: false, id: "", code: "" });
  const [deleteBotModal, setDeleteBotModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<{ open: boolean; id: string } | null>(null);
  const [confirmBulkDeleteTx, setConfirmBulkDeleteTx] = useState(false);
  const [confirmDeleteAllReferrals, setConfirmDeleteAllReferrals] = useState(false);
  const [confirmDeleteTutorial, setConfirmDeleteTutorial] = useState<{ open: boolean; id: string } | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
    const [newTeamLabel, setNewTeamLabel] = useState("");
    const [orphanApps, setOrphanApps] = useState<string[]>([]);
    const [orphanLoading, setOrphanLoading] = useState(false);
    const [orphanFetched, setOrphanFetched] = useState(false);
  const [deleteTeamModal, setDeleteTeamModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editTeamLabel, setEditTeamLabel] = useState("");

  async function handleDeleteTransaction(id: string) {
      setLoading(l => ({ ...l, ["deleteTx_" + id]: true }));
      try {
        const res = await deleteAdminTransaction(id);
        if (res.ok) {
          setTransactions((prev: Transaction[]) => prev.filter((t: Transaction) => t._id !== id));
          setConfirmDeleteTx(null);
        }
      } finally {
        setLoading(l => ({ ...l, ["deleteTx_" + id]: false }));
      }
    }

      const fetchData = useCallback(async (section: string) => {
    setLoading(prev => ({ ...prev, [section]: true }));
    try {
      switch (section) {
        case "stats": { const s = await getAdminStats(); if (!s.error) setStats(s); break; }
        case "users": { const u = await getAdminUsers(); if (Array.isArray(u)) setUsers(u); break; }
        case "bots": { const b = await getAdminBots(); if (Array.isArray(b)) setBots(b); break; }
        case "transactions": { const t = await getAdminTransactions(); if (Array.isArray(t)) setTransactions(t); break; }
        case "coupons": { const c = await getAdminCoupons(); if (Array.isArray(c)) setCoupons(c); break; }
        case "referrals": { const r = await getAdminReferrals(); if (Array.isArray(r)) setReferrals(r); break; }
        case "config": { const tm = await getAdminTeams(); if (Array.isArray(tm)) setTeams(tm); break; }
          case "database": { const d = await getAdminDbStats(); if (d && !d.error) setDbStats(d); break; }
          case "bot-templates": { const bt = await getBotTemplates(); if (Array.isArray(bt)) setBotTemplates(bt); break; }
          case "panel-plans": { const pp = await getAdminPanelPlans(); if (Array.isArray(pp)) setPanelPlans(pp); break; }
            case "panels": { const ap = await getAdminPanels(); if (Array.isArray(ap)) setAdminPanels(ap); break; }
            case "tutorials": { const tuts = await getAdminTutorials(); if (Array.isArray(tuts)) setTutorials(tuts); break; }
      }
    } catch {
      showToast(`Failed to load ${section}`, "error");
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }));
    }
  }, [showToast]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!isAdmin) { navigate("/"); return; }
    fetchData("stats");
    fetchData("users");
    fetchData("bots");
    fetchData("transactions");
    fetchData("coupons");
    fetchData("referrals");
    fetchData("config");
      fetchData("database");
  }, [user, isAdmin, navigate, fetchData]);

  useEffect(() => {
    if (drawerOpen) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (purgeModal.open) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [purgeModal.open]);

  const handleAction = async (action: string, fn: () => Promise<unknown>, onSuccess?: () => void) => {
    setLoading(prev => ({ ...prev, [action]: true }));
    try {
      const res = await fn() as { error?: string; ok?: boolean };
      if (res.error) {
        showToast(res.error, "error");
      } else {
        showToast(`${action} successful`, "success");
        onSuccess?.();
      }
    } catch {
      showToast(`Failed to ${action}`, "error");
    } finally {
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const handleCreateCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    const amount = parseInt(couponTx);
    if (!code || code.length < 3) { showToast("Code must be at least 3 characters", "error"); return; }
    if (!amount || amount < 1) { showToast("TX amount must be at least 1", "error"); return; }
    await handleAction("createCoupon", () => createCoupon(code, amount), () => {
      setCouponCode(""); setCouponTx(""); fetchData("coupons");
    });
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name || name.length < 2) { showToast("Team name must be at least 2 characters", "error"); return; }
    await handleAction("createTeam", () => createAdminTeam(name, newTeamLabel.trim()), () => {
      setNewTeamName(""); setNewTeamLabel(""); fetchData("config");
    });
  };

    const fetchOrphanApps = async () => {
      setOrphanLoading(true);
      try {
        const data = await getOrphanHerokuApps() as { orphans?: string[] };
        setOrphanApps(data.orphans || []);
        setOrphanFetched(true);
      } catch { showToast("Failed to fetch orphan apps", "error"); }
      finally { setOrphanLoading(false); }
    };

    const handleDeleteOrphan = async (appName: string) => {
      try {
        await deleteOrphanApp(appName);
        setOrphanApps(prev => prev.filter(a => a !== appName));
        showToast(`Deleted ${appName}`, "success");
      } catch { showToast("Failed to delete app", "error"); }
    };

  const handleUpdateTeamLabel = async (id: string) => {
    await handleAction("updateTeam", () => updateAdminTeam(id, editTeamLabel), () => {
      setEditTeamId(null); setEditTeamLabel(""); fetchData("config");
    });
  };

  const handleToggleTeamActive = async (team: HerokuTeam) => {
    await handleAction(`toggleTeam-${team._id}`, () => updateAdminTeam(team._id, team.billingLabel, !team.active), () => {
      fetchData("config");
    });
  };

  const openUserPanel = (u: AdminUser) => {
    setSelectedUser(u);
    setUserPanelOpen(true);
    setBanReason("");
    setTxAmount("");
    setSubtractAmount("");
    setNewPassword("");
  };

  const closeUserPanel = () => {
    setUserPanelOpen(false);
    setSelectedUser(null);
    setBanModalOpen(false);
    setTxModalOpen(false);
    setSubtractTxModalOpen(false);
    setPwModalOpen(false);
    setDeleteUserModalOpen(false);
  };

  const navigateTo = (tab: TabKey) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (u.username || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (!user || !isAdmin) return <PageLoader />;

  const currentNav = NAV_ITEMS.find(n => n.key === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm sm:text-base">Admin Panel</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 text-amber-400 text-sm font-mono">
              <span className="hidden sm:inline">@xhclinton</span>
              <Crown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </nav>

      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-[110] transform transition-transform duration-300 ease-out flex flex-col ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm">Admin Navigation</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <button
            onClick={() => { navigateWithLoader("/"); setDrawerOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="h-px bg-border my-2" />

          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => navigateTo(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Logged in as <span className="text-amber-400 font-mono">@xhclinton</span>
          </div>
        </div>
      </aside>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {currentNav?.icon}
            {currentNav?.label}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(activeTab === "overview" ? "stats" : activeTab)}
            disabled={loading[activeTab === "overview" ? "stats" : activeTab]}
          >
            <RefreshCw className={`w-4 h-4 ${loading[activeTab === "overview" ? "stats" : activeTab] ? "animate-spin" : ""}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard title="Users"            value={stats?.totalUsers ?? 0}           icon={<Users className="w-5 h-5" />} />
              <StatCard title="Bots"             value={stats?.totalBots ?? 0}            icon={<Bot className="w-5 h-5" />} />
              <StatCard title="Active Bots"      value={stats?.activeBots ?? 0}           icon={<Play className="w-5 h-5" />} />
              <StatCard title="TX Circulation"   value={stats?.totalTxInCirculation ?? 0} icon={<Coins className="w-5 h-5" />} />
              <StatCard title="Revenue (KES)"    value={stats?.totalRevenue ?? 0}         icon={<CreditCard className="w-5 h-5" />} />
              <StatCard title="Transactions"     value={stats?.totalTransactions ?? 0}    icon={<ShoppingBag className="w-5 h-5" />} />
              <StatCard title="Coupons"          value={stats?.totalCoupons ?? 0}         icon={<Gift className="w-5 h-5" />} />
              <StatCard title="Referrals"        value={stats?.totalReferrals ?? 0}       icon={<UsersRound className="w-5 h-5" />} />
              <StatCard title="Panels"           value={(stats as { totalPanels?: number })?.totalPanels ?? adminPanels.length} icon={<Server className="w-5 h-5" />} />
            </div>
            <div className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    Orphan Apps
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Apps deployed externally that don't belong to any user in the database</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" onClick={fetchOrphanApps} disabled={orphanLoading} size="sm">
                    {orphanLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {orphanFetched ? "Refresh" : "Scan for Orphan Apps"}
                  </Button>
                  {orphanFetched && (
                    orphanApps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No orphan apps found.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{orphanApps.length} orphan app{orphanApps.length !== 1 ? "s" : ""} found</p>
                        {orphanApps.map(app => (
                          <div key={app} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                            <span className="font-mono text-sm">{app}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-500/30"
                              onClick={() => handleDeleteOrphan(app)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                placeholder="Search by username or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="pl-9"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {loading["users"] ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {userSearch ? `No users matching "${userSearch}"` : "No users found"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(u => (
                  <button
                    key={u._id}
                    onClick={() => openUserPanel(u)}
                    className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary uppercase">
                          {(u.username || u.email)[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm">{u.username ? `@${u.username}` : "No username"}</span>
                            {u.email === "xhclinton@gmail.com" && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            {u.isBanned && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-400/10 text-red-400">Banned</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="text-purple-400 font-medium">{u.txCoins} TX</span>
                            <span>{u.botCount} bot{u.botCount !== 1 ? "s" : ""}</span>
                            <span>{formatDate(u.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 sm:mt-0 sm:shrink-0 flex-wrap justify-start sm:justify-end">
                        <span className="text-xs text-muted-foreground">Tap to manage</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground rotate-[-90deg]" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "bots" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by app name, phone, owner..."
                  value={botSearch}
                  onChange={e => setBotSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchData("bots")} className="gap-1.5 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
            {loading["bots"] ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : bots.filter(b => { const q = botSearch.toLowerCase(); if (!q) return true; return b.herokuAppName.toLowerCase().includes(q) || b.phoneNumber.includes(q) || b.ownerEmail.toLowerCase().includes(q) || (b.ownerUsername || "").toLowerCase().includes(q); }).map(b => (
              <div key={b._id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium truncate">{b.herokuAppName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.ownerEmail === "unknown" ? "⚠️ Owner account deleted" : `${b.ownerUsername ? `@${b.ownerUsername}` : "N/A"} · ${b.ownerEmail}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                          b.status === "running" ? "bg-green-400/10 text-green-400" :
                          b.status === "stopped" ? "bg-yellow-400/10 text-yellow-400" :
                          b.status === "expired" ? "bg-red-400/10 text-red-400" :
                          "bg-gray-400/10 text-gray-400"
                        }`}>{b.status}</span>
                        {(b as unknown as { templateName?: string }).templateName && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/20">{(b as unknown as { templateName?: string }).templateName}</span>
                        )}
                        <span className="text-xs text-muted-foreground">Expires: {formatDate(b.expiresAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" title="Logs" onClick={async () => { setAdminLogsBot(b.herokuAppName); setAdminLogsRefreshing(true); setAdminLogsOpen(true); try { const r = await getAdminBotLogs(b._id) as { logs?: string[] }; setAdminLogs(r.logs || []); } catch {} setAdminLogsRefreshing(false); }}>
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" title="Stop" onClick={() => handleAction(`stop-${b._id}`, () => stopAdminBot(b._id), () => fetchData("bots"))} disabled={loading[`stop-${b._id}`]}>
                      {loading[`stop-${b._id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" title="Start" onClick={() => handleAction(`start-${b._id}`, () => startAdminBot(b._id), () => fetchData("bots"))} disabled={loading[`start-${b._id}`]}>
                      {loading[`start-${b._id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" title="Restart" onClick={() => handleAction(`restart-${b._id}`, () => restartAdminBot(b._id), () => fetchData("bots"))} disabled={loading[`restart-${b._id}`]}>
                      {loading[`restart-${b._id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Delete" onClick={() => setDeleteBotModal({ open: true, id: b._id, name: b.herokuAppName })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "transactions" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                  onClick={async () => {
                    try {
                      const r = await resolveStaleTransactions() as { resolved?: number };
                      showToast(`Resolved ${r.resolved ?? 0} stale transactions`, "success");
                      fetchData("transactions");
                    } catch { showToast("Failed to resolve stale transactions", "error"); }
                  }}
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Resolve Stale
                </Button>
                {selectedTxIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                    onClick={async () => {
                      setConfirmBulkDeleteTx(true);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete Selected ({selectedTxIds.length})
                  </Button>
                )}
              </div>
              <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 w-8">
                        <input type="checkbox" checked={selectedTxIds.length === transactions.length && transactions.length > 0}
                          onChange={e => setSelectedTxIds(e.target.checked ? transactions.map((t: Transaction) => t._id) : [])} />
                      </th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">TX</th>
                      <th className="text-left p-3 font-medium">KES</th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading["transactions"] ? (
                      <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : transactions.map(t => {
                      const isCredit = t.type === "admin_grant" || t.type === "topup" || t.type === "refund" || t.type === "panel";
                      return (
                        <tr key={t._id} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <input type="checkbox" checked={selectedTxIds.includes(t._id)}
                              onChange={e => setSelectedTxIds(prev => e.target.checked ? [...prev, t._id] : prev.filter(id => id !== t._id))} />
                          </td>
                          <td className="p-3 capitalize">{t.type.replace("_", " ")}</td>
                          <td className="p-3 font-medium">
                            {t.status === "failed" ? <span className="text-red-400">Failed</span>
                             : t.status === "pending" ? <span className="text-yellow-400">Pending</span>
                             : <span className={isCredit ? "text-green-400" : "text-red-400"}>{(isCredit ? "+" : "-") + Math.abs(t.txAmount)}</span>}
                          </td>
                          <td className="p-3">{t.ksAmount}</td>
                          <td className="p-3 text-xs text-muted-foreground">{(t as unknown as { ownerEmail?: string }).ownerEmail || "N/A"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              t.status === "success" ? "bg-green-400/10 text-green-400" :
                              t.status === "pending" ? "bg-yellow-400/10 text-yellow-400" :
                              "bg-red-400/10 text-red-400"
                            }`}>{t.status}</span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(t.createdAt)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                {(t as unknown as { userId?: string }).userId && (
                                  <button
                                    onClick={() => {
                                      const u = users.find((u: AdminUser) => u._id === (t as unknown as { userId: string }).userId);
                                      if (u) { openUserPanel(u); setBanModalOpen(true); }
                                    }}
                                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                                    title="Ban User"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmDeleteTx({ open: true, id: t._id })}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                                  title="Delete Transaction"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

        {activeTab === "coupons" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Coupon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Code</Label>
                    <Input placeholder="e.g., WELCOME2024" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} maxLength={20} />
                  </div>
                  <div>
                    <Label>TX Amount</Label>
                    <Input type="number" placeholder="e.g., 10" value={couponTx} onChange={e => setCouponTx(e.target.value)} min={1} />
                  </div>
                </div>
                <Button onClick={handleCreateCoupon} disabled={loading["createCoupon"]}>
                  {loading["createCoupon"] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-1" />}
                  Create Coupon
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-left p-3 font-medium">TX</th>
                      <th className="text-left p-3 font-medium">Claimed By</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-left p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading["coupons"] ? (
                      <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : coupons.map(c => (
                      <tr key={c._id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-mono font-medium">{c.code}</td>
                        <td className="p-3 text-purple-400 font-medium">{c.txAmount}</td>
                        <td className="p-3 text-xs text-muted-foreground">{c.claimedBy || <span className="text-green-400">Available</span>}</td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="p-3">
                          <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300 h-7 px-2" onClick={() => setDeleteCouponModal({ open: true, id: c._id, code: c.code })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "referrals" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                onClick={async () => {
                  setConfirmDeleteAllReferrals(true);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete All
              </Button>
            </div>
            <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Referrer</th>
                    <th className="text-left p-3 font-medium">Referred</th>
                    <th className="text-left p-3 font-medium">TX Rewarded</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading["referrals"] ? (
                    <tr><td colSpan={4} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : referrals.map(r => (
                    <tr key={r._id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium text-xs">{r.referrerUsername ? `@${r.referrerUsername}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{r.referrerEmail}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-xs">{r.referredUsername ? `@${r.referredUsername}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{r.referredEmail}</div>
                      </td>
                      <td className="p-3 text-purple-400 font-medium">{r.txRewarded}</td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
  
        {activeTab === "database" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Manage and inspect database collections</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData("database")}
                className="gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
            {!dbStats ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {dbStats.quota && (
                  <div className="rounded-xl border border-border bg-card p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Storage Usage</p>
                      <span className="text-xs text-muted-foreground">{dbStats.quota.usedMb.toFixed(1)} MB / {dbStats.quota.quotaMb} MB quota</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${dbStats.quota.usedPercent > 90 ? 'bg-red-500' : dbStats.quota.usedPercent > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${dbStats.quota.usedPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>{dbStats.quota.usedPercent.toFixed(1)}% used</span>
                      <span>{dbStats.quota.remainingMb.toFixed(1)} MB remaining</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dbStats.collections.map((col: DbCollectionStat) => (
                  <div key={col.name} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{col.label}</p>
                        <p className="text-2xl font-bold mt-1">{col.count.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">documents</p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    {col.canPurge && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPurgeModal({ open: true, collection: col.name, label: col.label })}
                        className="w-full text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-400/20 hover:border-red-400/30"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Purge All
                      </Button>
                    )}
                  </div>
                ))}
                </div>
              </>
            )}
            {purgeModal.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Purge {purgeModal.label}?</h3>
                      <p className="text-xs text-muted-foreground">This cannot be undone</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    All documents in <span className="text-foreground font-medium">{purgeModal.label}</span> will be permanently deleted.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setPurgeModal({ open: false, collection: "", label: "" })}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={purging}
                      onClick={async () => {
                        setPurging(true);
                        try {
                          await purgeAdminCollection(purgeModal.collection);
                          setPurgeModal({ open: false, collection: "", label: "" });
                          await fetchData("database");
                          showToast(`Purged ${purgeModal.label}`, "success");
                        } catch {
                          showToast("Purge failed", "error");
                        } finally {
                          setPurging(false);
                        }
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {purging ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Purging...</> : "Yes, Purge"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "bot-templates" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Bot Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Bot Name</Label>
                    <Input placeholder="e.g. Toxic MD" value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Cost (TX)</Label>
                    <Input type="number" placeholder="10" value={newTemplate.costTx} onChange={e => setNewTemplate(p => ({ ...p, costTx: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">GitHub Repo URL</Label>
                    <Input placeholder="https://github.com/user/repo" value={newTemplate.githubRepo} onChange={e => setNewTemplate(p => ({ ...p, githubRepo: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Session ID URL</Label>
                    <Input placeholder="https://example.com/pairing" value={newTemplate.sessionIdUrl} onChange={e => setNewTemplate(p => ({ ...p, sessionIdUrl: e.target.value }))} />
                  </div>
                </div>
                <Button
                  disabled={addingTemplate}
                  onClick={async () => {
                    if (!newTemplate.name || !newTemplate.githubRepo || !newTemplate.sessionIdUrl) { showToast("Fill all fields", "error"); return; }
                    setAddingTemplate(true);
                    try {
                      const res = await addBotTemplate({ name: newTemplate.name, githubRepo: newTemplate.githubRepo, sessionIdUrl: newTemplate.sessionIdUrl, costTx: Number(newTemplate.costTx) || 10 }) as { ok?: boolean; error?: string };
                      if (res.error) { showToast(res.error, "error"); } else { showToast("Bot template added!", "success"); setNewTemplate({ name: "", githubRepo: "", sessionIdUrl: "", costTx: "10" }); fetchData("bot-templates"); }
                    } catch { showToast("Failed to add template", "error"); }
                    setAddingTemplate(false);
                  }}
                  className="gap-2"
                >
                  {addingTemplate ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Adding...</> : <><Plus className="w-3.5 h-3.5" />Add Template</>}
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{botTemplates.length} templates</p>
              <Button variant="outline" size="sm" onClick={() => fetchData("bot-templates")} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </Button>
            </div>

            {loading["bot-templates"] ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : botTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No bot templates yet.</div>
            ) : (
              <div className="space-y-3">
                {botTemplates.map(t => (
                  <div key={t._id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0"><p className="font-medium text-sm truncate">{t.name}</p>{typeof (t as { deployCount?: number }).deployCount === "number" && <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">{(t as { deployCount?: number }).deployCount} deployed</span>}</div>
                        {t.isDefault && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-400 font-semibold">Default</span>}
                        {((t as unknown as { deployCount?: number }).deployCount ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-500/15 text-green-400 border border-green-500/20">{(t as unknown as { deployCount?: number }).deployCount} deployed</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.githubRepo}</p>
                      <p className="text-xs text-purple-400 mt-0.5">{t.costTx} TX/month</p>
                    </div>
                    {!t.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTemplateModal({ open: true, id: t._id, name: t.name })}
                        className="text-red-400 border-red-400/20 hover:bg-red-400/10 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "panel-plans" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Panel Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Plan Name</Label>
                    <Input placeholder="e.g. Starter" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">TX Cost</Label>
                    <Input type="number" placeholder="20" value={newPlan.txCost} onChange={e => setNewPlan(p => ({ ...p, txCost: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">RAM</Label>
                    <Input placeholder="512MB" value={newPlan.ram} onChange={e => setNewPlan(p => ({ ...p, ram: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Disk</Label>
                    <Input placeholder="2GB" value={newPlan.disk} onChange={e => setNewPlan(p => ({ ...p, disk: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">CPU</Label>
                    <Input placeholder="1" value={newPlan.cpu} onChange={e => setNewPlan(p => ({ ...p, cpu: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs mb-1.5 block">Description</Label>
                    <Input placeholder="Perfect for small projects" value={newPlan.description} onChange={e => setNewPlan(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input type="checkbox" id="best-deal" checked={newPlan.isBestDeal} onChange={e => setNewPlan(p => ({ ...p, isBestDeal: e.target.checked }))} className="w-4 h-4 rounded accent-purple-500" />
                    <label htmlFor="best-deal" className="text-sm">Mark as Best Deal</label>
                  </div>
                </div>
                <Button
                  disabled={addingPlan}
                  onClick={async () => {
                    if (!newPlan.name || !newPlan.txCost) { showToast("Fill all required fields", "error"); return; }
                    setAddingPlan(true);
                    try {
                      const res = await createAdminPanelPlan({ name: newPlan.name, description: newPlan.description, txCost: Number(newPlan.txCost), ram: newPlan.ram, disk: newPlan.disk, cpu: newPlan.cpu, isBestDeal: newPlan.isBestDeal }) as { ok?: boolean; error?: string };
                      if (res.error) { showToast(res.error, "error"); } else { showToast("Panel plan added!", "success"); setNewPlan({ name: "", description: "", txCost: "20", ram: "512MB", disk: "2GB", cpu: "1", isBestDeal: false }); fetchData("panel-plans"); }
                    } catch { showToast("Failed to add plan", "error"); }
                    setAddingPlan(false);
                  }}
                  className="gap-2"
                >
                  {addingPlan ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Adding...</> : <><Plus className="w-3.5 h-3.5" />Add Plan</>}
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{panelPlans.length} plans</p>
              <Button variant="outline" size="sm" onClick={() => fetchData("panel-plans")} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </Button>
            </div>

            {loading["panel-plans"] ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : panelPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No panel plans yet.</div>
            ) : (
              <div className="space-y-3">
                {panelPlans.map(p => (
                  <div key={p._id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.isBestDeal && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-400 font-semibold">Best Deal</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                      <p className="text-xs mt-0.5">RAM: {p.ram} · Disk: {p.disk} · CPU: {p.cpu} · <span className="text-purple-400 font-medium">{p.txCost} TX</span></p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletePlanModal({ open: true, id: p._id, name: p.name })}
                      className="text-red-400 border-red-400/20 hover:bg-red-400/10 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "tutorials" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-400" />
                    Add Tutorial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Title</Label>
                      <Input placeholder="Tutorial title" value={newTutorialTitle} onChange={e => setNewTutorialTitle(e.target.value)} />
                    </div>
                    <div>
                      <Label>YouTube URL</Label>
                      <Input placeholder="https://youtu.be/..." value={newTutorialUrl} onChange={e => setNewTutorialUrl(e.target.value)} />
                    </div>
                    <div>
                      <Label>Order</Label>
                      <Input type="number" min={0} value={newTutorialOrder} onChange={e => setNewTutorialOrder(Number(e.target.value))} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={tutorialLoading || !newTutorialTitle.trim() || !newTutorialUrl.trim()}
                    onClick={async () => {
                      setTutorialLoading(true);
                      try {
                        await createAdminTutorial({ title: newTutorialTitle.trim(), youtubeUrl: newTutorialUrl.trim(), order: newTutorialOrder });
                        showToast("Tutorial added", "success");
                        setNewTutorialTitle(""); setNewTutorialUrl(""); setNewTutorialOrder(0);
                        const data = await getAdminTutorials() as { _id: string; title: string; youtubeUrl: string; order: number }[];
                        if (Array.isArray(data)) setTutorials(data);
                      } catch { showToast("Failed to add tutorial", "error"); }
                      finally { setTutorialLoading(false); }
                    }}
                  >
                    {tutorialLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    Add Tutorial
                  </Button>
                </CardContent>
              </Card>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">#</th>
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium">URL</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tutorials.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No tutorials yet</td></tr>
                    ) : tutorials.map(t => (
                      <tr key={t._id} className="border-b hover:bg-muted/30">
                        <td className="p-3 text-muted-foreground">{t.order}</td>
                        <td className="p-3 font-medium">{t.title}</td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">
                          <a href={t.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{t.youtubeUrl}</a>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={async () => {
                              setConfirmDeleteTutorial({ open: true, id: t._id });
                            }}
                            className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {activeTab === "config" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Team
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Team Name</Label>
                    <Input placeholder="e.g., toxicxtech254" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Billing Label</Label>
                    <Input placeholder="e.g., Main Account" value={newTeamLabel} onChange={e => setNewTeamLabel(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleCreateTeam} disabled={loading["createTeam"]}>
                  {loading["createTeam"] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-1" />}
                  Add Team
                </Button>
              </CardContent>
            </Card>

            {loading["config"] ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : teams.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No teams configured yet</div>
            ) : (
              <div className="space-y-2">
                {teams.map(t => (
                  <div key={t._id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-sm font-medium">{t.name}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${t.active ? "bg-green-400/10 text-green-400" : "bg-gray-400/10 text-gray-400"}`}>
                              {t.active ? "Active" : "Inactive"}
                            </span>
                            {t.isFull && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-400/10 text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5" />Full
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.billingLabel || <span className="italic opacity-50">No billing label</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {typeof t.appCount === "number" ? `${t.appCount} app${t.appCount !== 1 ? "s" : ""}` : "Loading..."}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => {
                              if (editTeamId === t._id) { setEditTeamId(null); } else {
                                setEditTeamId(t._id); setEditTeamLabel(t.billingLabel);
                              }
                            }}
                          >
                            {editTeamId === t._id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 text-xs ${t.active ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10" : "text-green-400 hover:text-green-300 hover:bg-green-400/10"}`}
                            onClick={() => handleToggleTeamActive(t)}
                            disabled={loading[`toggleTeam-${t._id}`]}
                          >
                            {loading[`toggleTeam-${t._id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (t.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />)}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            onClick={() => setDeleteTeamModal({ open: true, id: t._id, name: t.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {editTeamId === t._id && (
                        <div className="flex gap-2 pt-1 border-t border-border">
                          <Input
                            placeholder="Billing label"
                            value={editTeamLabel}
                            onChange={e => setEditTeamLabel(e.target.value)}
                            className="flex-1 h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleUpdateTeamLabel(t._id)}
                            disabled={loading["updateTeam"]}
                          >
                            {loading["updateTeam"] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide">How it works</p>
              <p>The site automatically picks the team with the fewest apps when deploying. Teams marked as full (100 apps) are skipped.</p>
              <p>When an app is transferred between teams, bot data (days remaining, expiry, etc.) stays unchanged — the team name in the database updates automatically.</p>
            </div>
          </div>
        )}

        {activeTab === "panels" && (
          <div className="space-y-3">
            {loading["panels"] ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : adminPanels.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No panels found</div>
            ) : (
              <div className="space-y-2">
                {adminPanels.map(p => (
                  <div key={p._id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{p.planName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.ownerEmail}{p.ownerUsername ? ` (@${p.ownerUsername})` : ""}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="font-mono text-purple-400">{p.panelUsername}</span>
                          <span>{p.txCost} TX</span>
                          <span>{formatDate(p.purchasedAt)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="text-red-400 border-red-500/30 hover:bg-red-500/10 shrink-0"
                        onClick={() => setDeletePanelModal({ open: true, id: p._id, name: p.planName })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DeleteConfirmModal
              isOpen={deletePanelModal.open}
              onClose={() => setDeletePanelModal({ open: false, id: "", name: "" })}
              onConfirm={async () => {
                try {
                  await deleteAdminPanel(deletePanelModal.id);
                  setAdminPanels(prev => prev.filter(p => p._id !== deletePanelModal.id));
                  showToast("Panel deleted", "success");
                } catch { showToast("Failed to delete", "error"); }
                finally { setDeletePanelModal({ open: false, id: "", name: "" }); }
              }}
              title="Delete Panel Record"
              description={`Remove "${deletePanelModal.name}" panel record from DB. Pterodactyl account is NOT deleted.`}
            />
          </div>
        )}
      </main>

      <Modal isOpen={userPanelOpen} onClose={closeUserPanel} title={`Manage — ${selectedUser?.username ? `@${selectedUser.username}` : selectedUser?.email ?? ""}`} maxWidth="max-w-md">
        {selectedUser && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate ml-4">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TX Balance</span>
                <span className="font-semibold text-purple-400">{selectedUser.txCoins} TX</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bots</span>
                <span>{selectedUser.botCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={selectedUser.isBanned ? "text-red-400" : "text-green-400"}>
                  {selectedUser.isBanned ? "Banned" : "Active"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span className="text-xs">{formatDate(selectedUser.createdAt)}</span>
              </div>
            </div>

            {!banModalOpen && !txModalOpen && !subtractTxModalOpen && !pwModalOpen && !deleteUserModalOpen && (
              <div className="grid grid-cols-2 gap-2">
                {selectedUser.email !== "xhclinton@gmail.com" && (
                  selectedUser.isBanned ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                      onClick={() => handleAction("Unban", () => unbanUser(selectedUser._id), () => { fetchData("users"); setSelectedUser(prev => prev ? { ...prev, isBanned: false } : prev); })}
                      disabled={loading["Unban"]}
                    >
                      {loading["Unban"] ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                      Unban
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setBanModalOpen(true)}>
                      <Ban className="w-3.5 h-3.5 mr-1" />Ban User
                    </Button>
                  )
                )}
                <Button variant="outline" size="sm" onClick={() => setTxModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Add TX
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSubtractTxModalOpen(true)}>
                  <Minus className="w-3.5 h-3.5 mr-1" />Subtract TX
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPwModalOpen(true)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />Reset PW
                </Button>
                {selectedUser.email !== "xhclinton@gmail.com" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10 col-span-2"
                    onClick={() => setDeleteUserModalOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />Delete User
                  </Button>
                )}
              </div>
            )}

            {banModalOpen && (
              <div className="space-y-3 border-t border-border pt-3">
                {selectedUser.isBanned ? (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400">
                    This user is already banned.
                  </div>
                ) : null}
                <p className="text-sm font-medium">Ban reason (optional)</p>
                <Input placeholder="Reason for ban..." value={banReason} onChange={e => setBanReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setBanModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                    onClick={() => handleAction("Ban", () => banUser(selectedUser._id, banReason), () => { fetchData("users"); setSelectedUser(prev => prev ? { ...prev, isBanned: true } : prev); setBanModalOpen(false); })}
                    disabled={loading["Ban"]}
                  >
                    {loading["Ban"] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Ban"}
                  </Button>
                </div>
              </div>
            )}

            {txModalOpen && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-sm font-medium">Add TX to {selectedUser.username ? `@${selectedUser.username}` : selectedUser.email}</p>
                <Input type="number" placeholder="Amount (min 1)" value={txAmount} onChange={e => setTxAmount(e.target.value)} min={1} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setTxModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const amt = parseInt(txAmount);
                      if (!amt || amt < 1) { showToast("Enter a valid amount", "error"); return; }
                      handleAction("Add TX", () => grantTx(selectedUser._id, amt), () => {
                        fetchData("users");
                        setSelectedUser(prev => prev ? { ...prev, txCoins: prev.txCoins + amt } : prev);
                        setTxAmount("");
                        setTxModalOpen(false);
                      });
                    }}
                    disabled={loading["Add TX"]}
                  >
                    {loading["Add TX"] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add TX"}
                  </Button>
                </div>
              </div>
            )}

            {subtractTxModalOpen && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-sm font-medium">Subtract TX from {selectedUser.username ? `@${selectedUser.username}` : selectedUser.email}</p>
                <Input type="number" placeholder="Amount (min 1)" value={subtractAmount} onChange={e => setSubtractAmount(e.target.value)} min={1} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSubtractTxModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white border-0"
                    onClick={() => {
                      const amt = parseInt(subtractAmount);
                      if (!amt || amt < 1) { showToast("Enter a valid amount", "error"); return; }
                      handleAction("Subtract TX", () => subtractTx(selectedUser._id, amt), () => {
                        fetchData("users");
                        setSelectedUser(prev => prev ? { ...prev, txCoins: Math.max(0, prev.txCoins - amt) } : prev);
                        setSubtractAmount("");
                        setSubtractTxModalOpen(false);
                      });
                    }}
                    disabled={loading["Subtract TX"]}
                  >
                    {loading["Subtract TX"] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subtract TX"}
                  </Button>
                </div>
              </div>
            )}

            {pwModalOpen && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-sm font-medium">New password for {selectedUser.username ? `@${selectedUser.username}` : selectedUser.email}</p>
                <Input type="password" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setPwModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (!newPassword || newPassword.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }
                      handleAction("Reset PW", () => resetPassword(selectedUser._id, newPassword), () => {
                        setNewPassword("");
                        setPwModalOpen(false);
                      });
                    }}
                    disabled={loading["Reset PW"]}
                  >
                    {loading["Reset PW"] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                  </Button>
                </div>
              </div>
            )}

            {deleteUserModalOpen && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-sm">This permanently deletes the user and all their bots. This cannot be undone.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteUserModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                    onClick={() => handleAction("Delete User", () => deleteUser(selectedUser._id), () => {
                      fetchData("users");
                      closeUserPanel();
                    })}
                    disabled={loading["Delete User"]}
                  >
                    {loading["Delete User"] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Permanently"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <DeleteConfirmModal
          isOpen={!!confirmDeleteTx?.open}
          onClose={() => setConfirmDeleteTx(null)}
          onConfirm={() => confirmDeleteTx && handleDeleteTransaction(confirmDeleteTx.id)}
          title="Delete Transaction"
          description="This will permanently remove this transaction record."
        />
        <DeleteConfirmModal
          isOpen={deleteCouponModal.open}
        onClose={() => setDeleteCouponModal({ open: false, id: "", code: "" })}
        onConfirm={() => handleAction("deleteCoupon", () => deleteCoupon(deleteCouponModal.id), () => { fetchData("coupons"); setDeleteCouponModal({ open: false, id: "", code: "" }); })}
        title={`Delete Coupon ${deleteCouponModal.code}?`}
        description="This coupon will be permanently deleted."
      />

      <DeleteConfirmModal
        isOpen={deleteBotModal.open}
        onClose={() => setDeleteBotModal({ open: false, id: "", name: "" })}
        onConfirm={() => handleAction("deleteBot", () => deleteAdminBot(deleteBotModal.id), () => { fetchData("bots"); setDeleteBotModal({ open: false, id: "", name: "" }); })}
        title={`Delete ${deleteBotModal.name}?`}
        description="This will permanently delete the bot and cannot be undone."
      />

      <DeleteConfirmModal
        isOpen={deleteTeamModal.open}
        onClose={() => setDeleteTeamModal({ open: false, id: "", name: "" })}
        onConfirm={() => handleAction("deleteTeam", () => deleteAdminTeam(deleteTeamModal.id), () => { fetchData("config"); setDeleteTeamModal({ open: false, id: "", name: "" }); })}
        title={`Remove Team "${deleteTeamModal.name}"?`}
        description="This removes the team from the rotation. Existing bots on this team will not be affected."
      />
      <DeleteConfirmModal
        isOpen={deleteTemplateModal.open}
        onClose={() => setDeleteTemplateModal({ open: false, id: "", name: "" })}
        onConfirm={() => handleAction("deleteTemplate", () => deleteBotTemplate(deleteTemplateModal.id), () => { fetchData("bot-templates"); setDeleteTemplateModal({ open: false, id: "", name: "" }); })}
        title={`Delete Bot Template "${deleteTemplateModal.name}"?`}
        description="This removes the bot template from the listing. Existing deployed bots will not be affected."
      />
      <DeleteConfirmModal
        isOpen={confirmBulkDeleteTx}
        onClose={() => setConfirmBulkDeleteTx(false)}
        onConfirm={async () => {
          setConfirmBulkDeleteTx(false);
          try {
            await deleteAdminTransactionsBulk(selectedTxIds);
            showToast(`Deleted ${selectedTxIds.length} transactions`, "success");
            setSelectedTxIds([]);
            fetchData("transactions");
          } catch { showToast("Bulk delete failed", "error"); }
        }}
        title={`Delete ${selectedTxIds.length} Transactions?`}
        description="This will permanently remove the selected transactions. This cannot be undone."
      />
      <DeleteConfirmModal
        isOpen={confirmDeleteAllReferrals}
        onClose={() => setConfirmDeleteAllReferrals(false)}
        onConfirm={async () => {
          setConfirmDeleteAllReferrals(false);
          try {
            await deleteAllAdminReferrals();
            showToast("All referrals deleted", "success");
            fetchData("referrals");
          } catch { showToast("Failed to delete referrals", "error"); }
        }}
        title="Delete All Referrals?"
        description="This will permanently remove ALL referral records. This cannot be undone."
      />
      <DeleteConfirmModal
        isOpen={!!confirmDeleteTutorial?.open}
        onClose={() => setConfirmDeleteTutorial(null)}
        onConfirm={async () => {
          if (!confirmDeleteTutorial) return;
          const id = confirmDeleteTutorial.id;
          setConfirmDeleteTutorial(null);
          try {
            await deleteAdminTutorial(id);
            setTutorials(prev => prev.filter(x => x._id !== id));
            showToast("Tutorial deleted", "success");
          } catch { showToast("Failed to delete tutorial", "error"); }
        }}
        title="Delete Tutorial?"
        description="This will permanently remove this tutorial."
      />
      <DeleteConfirmModal
        isOpen={deletePlanModal.open}
        onClose={() => setDeletePlanModal({ open: false, id: "", name: "" })}
        onConfirm={() => handleAction("deletePlan", () => deleteAdminPanelPlan(deletePlanModal.id), () => { fetchData("panel-plans"); setDeletePlanModal({ open: false, id: "", name: "" }); })}
        title={`Delete Panel Plan "${deletePlanModal.name}"?`}
        description="This removes the panel plan. Users who already purchased will not be affected."
      />
      <LogViewer
        isOpen={adminLogsOpen}
        onClose={() => setAdminLogsOpen(false)}
        logs={adminLogs}
        botName={adminLogsBot}
        onRefresh={async () => {
          setAdminLogsRefreshing(true);
          try {
            const bot = bots.find(b => b.herokuAppName === adminLogsBot);
            if (bot) { const res = await getAdminBotLogs(bot._id) as { logs?: string[] }; setAdminLogs(res.logs || []); }
          } catch {}
          setAdminLogsRefreshing(false);
        }}
        refreshing={adminLogsRefreshing}
      />
    </div>
  );
}
