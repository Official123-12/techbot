import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Coins, ArrowLeft, Check, Loader2, Phone, Globe, Send, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getPackages, initiateTigerPayPayment, checkTigerPayStatus, requestMinPay } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { PageLoader } from "@/components/PageLoader";
import { TechBackground } from "@/components/TechBackground";

interface Package {
  _id: string;
  name: string;
  ksPrice: number;
  txAmount: number;
  bonusTx: number;
  isBestDeal: boolean;
  order: number;
}

type Network = "vodacom" | "airtel" | "tigo" | "halotel";
type PaymentType = "local" | "international";
type Stage = "select" | "pending" | "success" | "failed";

const NETWORKS: { key: Network; label: string; color: string; prefix: string }[] = [
  { key: "vodacom", label: "Vodacom", color: "text-green-400", prefix: "255" },
  { key: "airtel", label: "Airtel", color: "text-red-400", prefix: "255" },
  { key: "tigo", label: "Tigo", color: "text-blue-400", prefix: "255" },
  { key: "halotel", label: "Halotel", color: "text-yellow-400", prefix: "255" },
];

// ===== FIXED: user parameter imeondolewa =====
function NetworkLogo({ network }: { network: Network }) {
  const icons: Record<Network, string> = {
    vodacom: "V",
    airtel: "A",
    tigo: "T",
    halotel: "H"
  };
  const colors: Record<Network, string> = {
    vodacom: "bg-green-500/20 text-green-400",
    airtel: "bg-red-500/20 text-red-400",
    tigo: "bg-blue-500/20 text-blue-400",
    halotel: "bg-yellow-500/20 text-yellow-400"
  };
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${colors[network]}`}>
      {icons[network]}
    </div>
  );
}

// ===== TIGERPAY MODAL (TANZANIA - AUTOMATIC) =====
function TigerPayModal({ isOpen, onClose, pkg, user, onSuccess }: { 
  isOpen: boolean; 
  onClose: () => void; 
  pkg: Package | null; 
  user: any; 
  onSuccess: () => void;
}) {
  const [network, setNetwork] = useState<Network>("vodacom");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setStage("select");
      setPhone("");
      setReference("");
      setMessage("");
      setFailReason("");
      setLoading(false);
      setPollCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stage !== "pending" || !reference) return;
    let count = 0;
    const interval = setInterval(async () => {
      count += 1;
      setPollCount(count);
      if (count >= 40) {
        clearInterval(interval);
        setStage("failed");
        setFailReason("Payment timed out.");
        return;
      }
      try {
        const data = await checkTigerPayStatus(reference) as { status?: string; txAmount?: number; error?: string };
        if (data.status === "success") {
          clearInterval(interval);
          setStage("success");
          showToast(`Payment confirmed! ${data.txAmount ?? 0} SQ added.`, "success");
          onSuccess();
          return;
        }
        if (["failed", "abandoned", "cancelled"].includes(data.status || "")) {
          clearInterval(interval);
          setStage("failed");
          setFailReason("Payment failed. Please try again.");
          return;
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, reference, onSuccess, showToast]);

  const handleSubmit = async () => {
    if (!pkg) return;
    if (!phone.trim() || phone.length < 9) {
      showToast("Enter a valid phone number", "error");
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = phone.replace(/\D/g, "");
      const res = await initiateTigerPayPayment({
        amount: pkg.ksPrice,
        phone: formattedPhone,
        network,
        packageId: pkg._id
      }) as { error?: string; reference?: string; message?: string };
      if (res.error) { showToast(res.error, "error"); setLoading(false); return; }
      setReference(res.reference || "");
      setMessage(res.message || `Check your ${network} phone for the payment prompt.`);
      setPollCount(0);
      setStage("pending");
    } catch { showToast("Failed to initiate payment", "error"); }
    setLoading(false);
  };

  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pay with Mobile Network" maxWidth="max-w-sm">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{totalTx} SQ added.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            Done
          </button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-red-400">Payment Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{failReason}</p>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); setReference(""); }} 
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Try Again
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Close
            </button>
          </div>
        </div>
      ) : stage === "pending" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
          <div className="text-center">
            <p className="font-semibold">Waiting for payment...</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (pollCount / 40) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">This may take up to 2 minutes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="font-bold text-purple-400">{totalTx} SQ</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">TSh {pkg.ksPrice}</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map(n => (
              <button
                key={n.key}
                onClick={() => setNetwork(n.key)}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border transition-all ${
                  network === n.key ? "border-purple-500/60 bg-purple-500/10" : "border-border hover:border-border/80"
                }`}
              >
                <NetworkLogo network={n.key} />
                <span className="text-[10px] font-medium text-muted-foreground">{n.label}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Phone Number</label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-2.5 rounded-lg bg-muted border border-border text-sm font-mono">+255</span>
              <input
                type="tel"
                placeholder="712345678"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                maxLength={9}
                className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Enter 9 digits (e.g., 712345678)</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            {loading ? "Initiating..." : `Pay TSh ${pkg.ksPrice}`}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ===== MIN PAY MODAL (INTERNATIONAL - MANUAL) =====
function MinPayModal({ isOpen, onClose, pkg, user, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  pkg: Package | null;
  user: any;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const ADMIN_PHONE = "255787069580";
  const ADMIN_NAME = "Stanley";

  useEffect(() => {
    if (!isOpen) {
      setEmail(user?.email || "");
      setSubmitted(false);
      setLoading(false);
      setCopied(false);
    }
  }, [isOpen, user]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ADMIN_PHONE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSubmit = async () => {
    if (!pkg) return;
    if (!email.trim() || !email.includes("@")) {
      showToast("Enter a valid email", "error");
      return;
    }
    setLoading(true);
    try {
      const totalTx = pkg.txAmount + pkg.bonusTx;
      const res = await requestMinPay({
        packageId: pkg._id,
        txAmount: totalTx,
        ksAmount: pkg.ksPrice,
        username: user?.username || "User",
        email: email.trim()
      }) as { error?: string; success?: boolean; adminPhone?: string; adminName?: string };
      if (res.error) { showToast(res.error, "error"); setLoading(false); return; }
      setSubmitted(true);
      showToast("Request sent! Admin will confirm shortly.", "success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } catch { showToast("Failed to submit request", "error"); }
    setLoading(false);
  };

  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="International Payment" maxWidth="max-w-sm">
      {submitted ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Request Submitted!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Send TSh {pkg.ksPrice} to <span className="font-mono font-bold">{ADMIN_NAME} - {ADMIN_PHONE}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Include your username <span className="font-mono">@{user?.username}</span> in the payment description.
            </p>
            <p className="text-xs text-muted-foreground mt-1">Admin will confirm within 5-10 minutes.</p>
          </div>
          <button
            onClick={() => window.open(`https://wa.me/${ADMIN_PHONE}`, "_blank")}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact Admin on WhatsApp
          </button>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
            Close
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="font-bold text-purple-400">{totalTx} SQ</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">TSh {pkg.ksPrice}</p>
          </div>

          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm font-medium text-blue-300 mb-2">How to pay:</p>
            <ol className="text-xs text-blue-200/80 space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                <span>Send TSh {pkg.ksPrice} to:</span>
              </li>
              <li className="flex items-center gap-2 pl-4">
                <span className="font-mono font-bold text-blue-300">{ADMIN_NAME} - {ADMIN_PHONE}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-blue-500/20 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                <span>Include your username <span className="font-mono">@{user?.username}</span> in description</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                <span>Click WhatsApp button below and send screenshot</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                <span>Admin confirms and adds SQ to your account</span>
              </li>
            </ol>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Email (for receipt)</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ===== MAIN TOPUP PAGE =====
export default function TopUp() {
  const { user, loading, refreshUser } = useAuth();
  const { showToast } = useToast();
  const { navigateWithLoader } = useNavLoader();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState<Package[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [tigerPayModalOpen, setTigerPayModalOpen] = useState(false);
  const [minPayModalOpen, setMinPayModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>("local");

  useEffect(() => {
    const status = searchParams.get("status");
    const ref = searchParams.get("ref");
    if (status === "success" && ref) { showToast("Payment confirmed! SQ added.", "success"); refreshUser(); }
    else if (status === "failed") { showToast("Payment failed or was cancelled.", "error"); }
  }, [searchParams, showToast, refreshUser]);

  useEffect(() => {
    getPackages()
      .then(data => setPackages((data as Package[]).sort((a, b) => a.order - b.order)))
      .catch(() => showToast("Failed to load packages", "error"))
      .finally(() => setPkgLoading(false));
  }, [showToast]);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigateWithLoader("/dashboard")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Top Up SQ</h1>
            <p className="text-sm text-muted-foreground">Add SQ coins to your account</p>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Coins className="w-4 h-4 text-yellow-400" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Balance</span>
                <span className="font-semibold text-sm">{user.txCoins} SQ</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setPaymentType("local")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${
              paymentType === "local" 
                ? "border-purple-500/60 bg-purple-500/10 text-purple-400" 
                : "border-border hover:border-border/80 text-muted-foreground"
            }`}
          >
            <Phone className="w-4 h-4" />
            <span className="text-sm font-medium">🇹🇿 Tanzania</span>
          </button>
          <button
            onClick={() => setPaymentType("international")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${
              paymentType === "international" 
                ? "border-purple-500/60 bg-purple-500/10 text-purple-400" 
                : "border-border hover:border-border/80 text-muted-foreground"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">🌍 International</span>
          </button>
        </div>

        {pkgLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3">
              {packages.map(pkg => {
                const total = pkg.txAmount + pkg.bonusTx;
                return (
                  <div key={pkg._id}
                    className={`relative w-full p-4 rounded-xl border transition-all hover:border-purple-500/40 hover:bg-purple-500/5 ${
                      pkg.isBestDeal ? "border-purple-500/50 bg-purple-500/5" : "border-border bg-card/50"
                    }`}>
                    {pkg.isBestDeal && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full uppercase tracking-wide">Best Deal</span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{pkg.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {pkg.txAmount} SQ{pkg.bonusTx > 0 ? ` + ${pkg.bonusTx} bonus` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-purple-400">{total} SQ</p>
                        <p className="text-sm text-muted-foreground">TSh {pkg.ksPrice}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button 
                        onClick={() => { 
                          setSelectedPkg(pkg); 
                          if (paymentType === "local") {
                            setTigerPayModalOpen(true);
                          } else {
                            setMinPayModalOpen(true);
                          }
                        }}
                        className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
                      >
                        Purchase
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border border-dashed border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Custom Amount</p>
                  <p className="text-sm text-muted-foreground">Choose exactly how many SQ you need</p>
                </div>
                <button 
                  onClick={() => {}}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors border border-border"
                >
                  Custom
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <TigerPayModal
        isOpen={tigerPayModalOpen}
        onClose={() => setTigerPayModalOpen(false)}
        pkg={selectedPkg}
        user={user}
        onSuccess={() => { refreshUser(); setTigerPayModalOpen(false); }}
      />

      <MinPayModal
        isOpen={minPayModalOpen}
        onClose={() => setMinPayModalOpen(false)}
        pkg={selectedPkg}
        user={user}
        onSuccess={() => { refreshUser(); setMinPayModalOpen(false); }}
      />
    </div>
  );
}