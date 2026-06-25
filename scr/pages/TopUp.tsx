import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router";
import { Coins, ArrowLeft, Check, Loader2, Plus, Minus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getPackages, initiatePayment, getMobileChargeStatus, verifyPayment } from "@/lib/api";
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

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: Package | null;
  userEmail: string;
  onSuccess: () => void;
}

type PayMethod = "mpesa" | "airtel" | "card" | "apple_pay";
type Stage = "select" | "pending" | "success" | "failed";

function toPaystackPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+254" + digits.slice(1);
  if (digits.length === 9) return "+254" + digits;
  return "+" + digits;
}

function isValidKenyanPhone(phone: string): boolean {
  return /^\+254\d{9}$/.test(toPaystackPhone(phone));
}

function MpesaLogo() {
  return (
    <svg viewBox="0 0 64 40" className="w-14 h-9" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="40" rx="5" fill="#009A44"/>
      <path d="M14 26 L14 14 L20 22 L26 14 L26 26" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <rect x="8" y="29" width="22" height="1.2" rx="0.6" fill="white" opacity="0.35"/>
      <text x="19" y="37" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="800" fontFamily="Arial, sans-serif" letterSpacing="2.5">PESA</text>
      <text x="46" y="19" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Arial, sans-serif" letterSpacing="0.3">M-PESA</text>
      <text x="46" y="30" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="400" fontFamily="Arial, sans-serif" letterSpacing="0.2" opacity="0.75">by Safaricom</text>
    </svg>
  );
}

function AirtelLogo() {
  return (
    <svg viewBox="0 0 64 40" className="w-14 h-9" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="40" rx="5" fill="#ED1C24"/>
      <path d="M10 30 Q18 6 26 30" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M13.5 30 Q18 12 22.5 30" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.7"/>
      <path d="M16.5 30 Q18 19 19.5 30" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.45"/>
      <circle cx="18" cy="31.5" r="2" fill="white"/>
      <text x="44" y="18" textAnchor="middle" fill="white" fontSize="9.5" fontWeight="700" fontFamily="Arial, sans-serif" letterSpacing="0.2">airtel</text>
      <text x="44" y="30" textAnchor="middle" fill="white" fontSize="7" fontWeight="500" fontFamily="Arial, sans-serif" letterSpacing="0.5" opacity="0.85">money</text>
    </svg>
  );
}

function CardLogo() {
  return (
    <svg viewBox="0 0 72 24" className="w-14 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="24" rx="4" fill="#16213E"/>
      <text x="6" y="10" fill="white" fontSize="8" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5" opacity="0.9">VISA</text>
      <text x="6" y="20" fill="white" fontSize="4.5" fontWeight="400" fontFamily="Arial, sans-serif" letterSpacing="0.3" opacity="0.5">DEBIT / CREDIT</text>
      <circle cx="52" cy="12" r="6.5" fill="#EB001B"/>
      <circle cx="61" cy="12" r="6.5" fill="#F79E1B"/>
      <path d="M56.5 6.3 A6.5 6.5 0 0 1 56.5 17.7 A6.5 6.5 0 0 1 56.5 6.3Z" fill="#FF5F00"/>
    </svg>
  );
}

function ApplePayLogo() {
  return (
    <svg viewBox="0 0 72 24" className="w-14 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="24" rx="4" fill="#000000"/>
      <path d="M21 5.5c.7-.1 1.6-.55 2.1-1.15.45-.6.8-1.45.7-2.35-.75.05-1.65.5-2.15 1.1-.45.55-.85 1.4-.65 2.4z" fill="white"/>
      <path d="M23.5 6.7c-1.15 0-2.1.7-2.65.7-.6 0-1.5-.65-2.5-.65-1.25 0-2.45.75-3.1 1.9-1.35 2.3-.35 5.7 1 7.55.65.9 1.4 1.8 2.45 1.8 1 0 1.35-.65 2.45-.65 1.15 0 1.45.65 2.5.65 1.05 0 1.75-.9 2.4-1.8.45-.65.65-.95.65-1-.05 0-1.8-.7-1.8-2.8 0-1.75 1.35-2.6 1.4-2.65-.8-1.25-2-1.05-2.8-1.05z" fill="white"/>
      <text x="47" y="10.5" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" fontFamily="-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif" letterSpacing="0.2">Apple</text>
      <text x="47" y="19" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600" fontFamily="-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif" letterSpacing="0.3">Pay</text>
    </svg>
  );
}

function PaymentModal({ isOpen, onClose, pkg, userEmail, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<PayMethod>("mpesa");
  const [phone, setPhone] = useState("");
  const [cardEmail, setCardEmail] = useState(userEmail || "");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const { showToast } = useToast();

  const handleClose = () => {
    if (stage === "pending") {
      showToast("Payment cancelled. If you were charged, please contact support.", "error");
    }
    onClose();
  };

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
        setFailReason("Payment timed out — you did not complete the payment in time.");
        return;
      }
      try {
        const data = await getMobileChargeStatus(reference) as { status?: string; txAmount?: number; error?: string };
        if (data.error) return;
        if (data.status === "success") { clearInterval(interval); setStage("success"); showToast(`Payment confirmed! ${data.txAmount ?? 0} TX added.`, "success"); onSuccess(); return; }
        if (data.status === "failed") { clearInterval(interval); setStage("failed"); setFailReason("Payment failed. Please try again."); return; }
        if (data.status === "abandoned") { clearInterval(interval); setStage("failed"); setFailReason("Payment was abandoned."); return; }
        if (data.status === "cancelled") { clearInterval(interval); setStage("failed"); setFailReason("Payment was cancelled."); return; }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, reference, onSuccess, showToast]);

  const handleMobileCharge = async () => {
    if (!pkg) return;
    if (!phone.trim() || !isValidKenyanPhone(phone)) { showToast("Enter a valid phone (e.g. 0712345678)", "error"); return; }
    setLoading(true);
    try {
      const normalized = toPaystackPhone(phone);
      const provider = method === "airtel" ? "airtel" : "mpesa";
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ packageId: pkg._id, phone: normalized, provider })
      });
      const data = await res.json() as { error?: string; reference?: string; message?: string };
      if (data.error) { showToast(data.error, "error"); setLoading(false); return; }
      setReference(data.reference || "");
      setMessage(data.message || "Check your phone for the payment prompt.");
      setPollCount(0);
      setStage("pending");
    } catch { showToast("Failed to initiate payment", "error"); }
    setLoading(false);
  };

  const handlePopupPay = async (channels: string[]) => {
      if (!pkg) return;
      if (channels.includes("apple_pay") && !("ApplePaySession" in window)) { showToast("Apple Pay is only available on Apple devices using Safari.", "error"); return; }
      if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
      setLoading(true);
      try {
        const paystackPop = (window as unknown as { PaystackPop?: new () => {
          resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
          newTransaction: (config: Record<string, unknown>) => void;
        } }).PaystackPop;
        if (!paystackPop) { showToast("Payment system not loaded. Refresh and try again.", "error"); setLoading(false); return; }
        if (channels.includes("card")) {
          const [cardData, configData] = await Promise.all([
            fetch("/api/payments/prepare-card", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
              body: JSON.stringify({ packageId: pkg._id })
            }).then(r => r.json()),
            fetch("/api/payments/config").then(r => r.json())
          ]);
          const ref = (cardData as { reference?: string }).reference;
          const publicKey = (configData as { paystackPublicKey?: string }).paystackPublicKey || "";
          if (!ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
          setLoading(false);
          const instance = new paystackPop();
          instance.newTransaction({
            key: publicKey,
            email: cardEmail,
            amount: pkg.ksPrice * 100,
            currency: "KES",
            ref,
            channels: ["card"],
            onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`Payment confirmed! ${totalTx} TX added.`, "success"); onSuccess(); },
            onCancel: () => { setStage("failed"); setFailReason("Card payment was cancelled."); },
            onError: () => { setStage("failed"); setFailReason("Card payment encountered an error. Please try again."); }
          });
        } else {
          const initData = await initiatePayment(pkg._id);
          const accessCode = (initData as { accessCode?: string }).accessCode;
          const ref = (initData as { reference?: string }).reference;
          if (!accessCode || !ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
          setLoading(false);
          const instance = new paystackPop();
          instance.resumeTransaction(accessCode, {
            onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`Payment confirmed! ${totalTx} TX added.`, "success"); onSuccess(); },
            onLoad: () => {},
            onCancel: () => { setStage("failed"); setFailReason("Apple Pay payment was cancelled."); },
            onError: () => { setStage("failed"); setFailReason("Apple Pay encountered an error. Please try again."); }
          });
        }
      } catch { showToast("Payment failed", "error"); setLoading(false); }
    };
  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;

  const methodOptions: { key: PayMethod; label: string; Logo: () => ReactElement }[] = [
    { key: "mpesa", label: "M-Pesa", Logo: MpesaLogo },
    { key: "airtel", label: "Airtel", Logo: AirtelLogo },
    { key: "card", label: "Card", Logo: CardLogo },
    { key: "apple_pay", label: "Apple Pay", Logo: ApplePayLogo },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Complete Payment" maxWidth="max-w-sm">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{totalTx} TX has been added to your account.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-red-400">Payment Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{failReason}</p>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); setReference(""); }} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Try Again</button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
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
              <span className="font-bold text-purple-400">{totalTx} TX</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">KES {pkg.ksPrice} <span className="text-muted-foreground/60">≈ ${(pkg.ksPrice * 0.0077).toFixed(2)} USD</span></p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {methodOptions.map(({ key, label, Logo }) => (
              <button key={key} onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border transition-all ${method === key ? "border-purple-500/60 bg-purple-500/10" : "border-border hover:border-border/80"}`}
                title={label}
              >
                <Logo />
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>

          {(method === "mpesa" || method === "airtel") ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Phone Number</label>
                <input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              </div>
              <button onClick={handleMobileCharge} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Initiating..." : `Pay KES ${pkg.ksPrice}`}
              </button>
            </div>
          ) : method === "card" ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              </div>
              <button onClick={() => handlePopupPay(["card"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : `Pay with Card — KES ${pkg.ksPrice}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              </div>
              <button onClick={() => handlePopupPay(["apple_pay"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : "Pay with Apple Pay"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const TX_RATE_KES = 5;
const TX_MIN = 3;

function CustomTxModal({ isOpen, onClose, userEmail, onSuccess }: { isOpen: boolean; onClose: () => void; userEmail: string; onSuccess: () => void }) {
  const [txAmount, setTxAmount] = useState(10);
  const [method, setMethod] = useState<PayMethod>("mpesa");
  const [phone, setPhone] = useState("");
  const [cardEmail, setCardEmail] = useState(userEmail || "");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const { showToast } = useToast();

  const ksPrice = txAmount * TX_RATE_KES;

  useEffect(() => {
    if (!isOpen) { setStage("select"); setPhone(""); setReference(""); setMessage(""); setFailReason(""); setLoading(false); setPollCount(0); setTxAmount(10); }
  }, [isOpen]);

  useEffect(() => {
    if (stage !== "pending" || !reference) return;
    let count = 0;
    const interval = setInterval(async () => {
      count += 1;
      setPollCount(count);
      if (count >= 40) { clearInterval(interval); setStage("failed"); setFailReason("Payment timed out."); return; }
      try {
        const data = await getMobileChargeStatus(reference) as { status?: string; txAmount?: number; error?: string };
        if (data.status === "success") { clearInterval(interval); setStage("success"); showToast(`${data.txAmount ?? txAmount} TX added!`, "success"); onSuccess(); return; }
        if (["failed", "abandoned", "cancelled"].includes(data.status || "")) { clearInterval(interval); setStage("failed"); setFailReason("Payment failed. Please try again."); return; }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, reference, onSuccess, showToast, txAmount]);

  const handleMobileCharge = async () => {
    if (!phone.trim() || !isValidKenyanPhone(phone)) { showToast("Enter a valid phone", "error"); return; }
    setLoading(true);
    try {
      const normalized = toPaystackPhone(phone);
      const provider = method === "airtel" ? "airtel" : "mpesa";
      const res = await fetch("/api/payments/charge-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ txAmount, ksAmount: ksPrice, phone: normalized, provider })
      });
      const data = await res.json() as { error?: string; reference?: string; message?: string };
      if (data.error) { showToast(data.error, "error"); setLoading(false); return; }
      setReference(data.reference || "");
      setMessage(data.message || "Check your phone for the payment prompt.");
      setPollCount(0);
      setTxAmount(10);
      setStage("pending");
    } catch { showToast("Failed to initiate payment", "error"); }
    setLoading(false);
  };

  const handlePopupPay = async (channels: string[]) => {
      if (channels.includes("apple_pay") && !("ApplePaySession" in window)) { showToast("Apple Pay is only available on Apple devices using Safari.", "error"); return; }
      if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
      setLoading(true);
      try {
        const paystackPop = (window as unknown as { PaystackPop?: new () => {
          resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
          newTransaction: (config: Record<string, unknown>) => void;
        } }).PaystackPop;
        if (!paystackPop) { showToast("Payment system not loaded.", "error"); setLoading(false); return; }
        if (channels.includes("card")) {
          const [cardData, configData] = await Promise.all([
            fetch("/api/payments/prepare-card-custom", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
              body: JSON.stringify({ txAmount, ksAmount: ksPrice })
            }).then(r => r.json()),
            fetch("/api/payments/config").then(r => r.json())
          ]);
          const ref = (cardData as { reference?: string }).reference;
          const publicKey = (configData as { paystackPublicKey?: string }).paystackPublicKey || "";
          if (!ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
          setLoading(false);
          const instance = new paystackPop();
          instance.newTransaction({
            key: publicKey,
            email: cardEmail,
            amount: ksPrice * 100,
            currency: "KES",
            ref,
            channels: ["card"],
            onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`${txAmount} TX added!`, "success"); onSuccess(); },
            onCancel: () => { setStage("failed"); setFailReason("Card payment was cancelled."); },
            onError: () => { setStage("failed"); setFailReason("Card payment encountered an error. Please try again."); }
          });
        } else {
          const initData = await fetch("/api/payments/initiate-custom", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
            body: JSON.stringify({ txAmount, ksAmount: ksPrice })
          }).then(r => r.json());
          const accessCode = (initData as { accessCode?: string }).accessCode;
          const ref = (initData as { reference?: string }).reference;
          if (!accessCode || !ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
          setLoading(false);
          const instance = new paystackPop();
          instance.resumeTransaction(accessCode, {
            onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`${txAmount} TX added!`, "success"); onSuccess(); },
            onLoad: () => {},
            onCancel: () => { setStage("failed"); setFailReason("Apple Pay payment was cancelled."); },
            onError: () => { setStage("failed"); setFailReason("Apple Pay encountered an error. Please try again."); }
          });
        }
      } catch { showToast("Payment failed", "error"); setLoading(false); }
    };
  const methodOptions: { key: PayMethod; label: string; Logo: () => ReactElement }[] = [
    { key: "mpesa", label: "M-Pesa", Logo: MpesaLogo },
    { key: "airtel", label: "Airtel", Logo: AirtelLogo },
    { key: "card", label: "Card", Logo: CardLogo },
    { key: "apple_pay", label: "Apple Pay", Logo: ApplePayLogo },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom TX Purchase" maxWidth="max-w-sm">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center"><Check className="w-8 h-8 text-green-400" /></div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{txAmount} TX added to your balance.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-center"><p className="font-semibold text-lg text-red-400">Failed</p><p className="text-sm text-muted-foreground mt-1">{failReason}</p></div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); setReference(""); }} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Try Again</button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
          </div>
        </div>
      ) : stage === "pending" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
          <div className="text-center"><p className="font-semibold">Waiting for payment...</p><p className="text-sm text-muted-foreground mt-1">{message}</p></div>
          <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (pollCount / 40) * 100)}%` }} /></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">How many TX do you want?</p>
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setTxAmount(v => Math.max(TX_MIN, v - 1))} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"><Minus className="w-4 h-4" /></button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  inputMode="numeric"
                  value={txAmount}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= TX_MIN) setTxAmount(v);
                  }}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10);
                    setTxAmount(isNaN(v) || v < TX_MIN ? TX_MIN : v);
                  }}
                  min={TX_MIN}
                  className="w-full text-center text-3xl font-bold text-purple-400 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <p className="text-xs text-muted-foreground">TX Coins</p>
              </div>
              <button onClick={() => setTxAmount(v => v + 1)} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-semibold">KES {ksPrice} <span className="text-muted-foreground/60 text-xs">≈ ${(ksPrice * 0.0077).toFixed(2)} USD</span></span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {methodOptions.map(({ key, label, Logo }) => (
              <button key={key} onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border transition-all ${method === key ? "border-purple-500/60 bg-purple-500/10" : "border-border hover:border-border/80"}`}
                title={label}
              >
                <Logo />
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>

          {(method === "mpesa" || method === "airtel") ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Phone Number</label>
                <input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              </div>
              <button onClick={handleMobileCharge} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Initiating..." : `Pay KES ${ksPrice}`}
              </button>
            </div>
          ) : method === "card" ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              </div>
              <button onClick={() => handlePopupPay(["card"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : `Pay with Card — KES ${ksPrice}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              </div>
              <button onClick={() => handlePopupPay(["apple_pay"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : "Pay with Apple Pay"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function TopUp() {
  const { user, loading, refreshUser } = useAuth();
  const { showToast } = useToast();
  const { navigateWithLoader } = useNavLoader();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState<Package[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  useEffect(() => {
    const status = searchParams.get("status");
    const ref = searchParams.get("ref");
    if (status === "success" && ref) { showToast("Payment confirmed! TX added to your balance.", "success"); refreshUser(); }
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
            <h1 className="text-2xl font-bold">Top Up</h1>
            <p className="text-sm text-muted-foreground">Add TX coins to your account</p>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Coins className="w-4 h-4 text-yellow-400" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Balance</span>
                <span className="font-semibold text-sm">{user.txCoins} TX</span>
              </div>
            </div>
          )}
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
                    className={`relative w-full p-4 rounded-xl border transition-all hover:border-purple-500/40 hover:bg-purple-500/5 ${pkg.isBestDeal ? "border-purple-500/50 bg-purple-500/5" : "border-border bg-card/50"}`}>
                    {pkg.isBestDeal && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full uppercase tracking-wide">Best Deal</span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{pkg.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {pkg.txAmount} TX{pkg.bonusTx > 0 ? ` + ${pkg.bonusTx} bonus` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-purple-400">{total} TX</p>
                        <p className="text-sm text-muted-foreground">KES {pkg.ksPrice}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => { setSelectedPkg(pkg); setModalOpen(true); }}
                        className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors">
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
                  <p className="text-sm text-muted-foreground">Choose exactly how many TX you need</p>
                </div>
                <button onClick={() => setCustomModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors border border-border">
                  Custom
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        pkg={selectedPkg}
        userEmail={user?.email || ""}
        onSuccess={() => { refreshUser(); setModalOpen(false); }}
      />
      <CustomTxModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        userEmail={user?.email || ""}
        onSuccess={() => { refreshUser(); setCustomModalOpen(false); }}
      />
    </div>
  );
}
