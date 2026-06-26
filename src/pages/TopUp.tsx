import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router";
import { Coins, ArrowLeft, Check, Loader2, Plus, Minus, Upload, FileImage, Globe } from "lucide-react";
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

type PayMethod = "tigerpay" | "minpay";
type Stage = "select" | "pending" | "success" | "failed" | "minpay_upload";

// ============================================
// TIGERPAY LOGO
// ============================================
function TigerPayLogo() {
  return (
    <svg viewBox="0 0 72 24" className="w-14 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="24" rx="4" fill="#1a1a2e"/>
      <text x="8" y="15" fill="#f7931a" fontSize="10" fontWeight="800" fontFamily="Arial, sans-serif">TIGER</text>
      <text x="36" y="15" fill="white" fontSize="10" fontWeight="700" fontFamily="Arial, sans-serif">PAY</text>
      <text x="8" y="21" fill="#666" fontSize="5" fontWeight="400" fontFamily="Arial, sans-serif">AUTO PAYMENT</text>
    </svg>
  );
}

// ============================================
// MINPAY LOGO
// ============================================
function MinpayLogo() {
  return (
    <svg viewBox="0 0 72 24" className="w-14 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="24" rx="4" fill="#0d47a1"/>
      <text x="8" y="15" fill="white" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif">MIN</text>
      <text x="28" y="15" fill="#f7931a" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif">PAY</text>
      <text x="8" y="21" fill="#666" fontSize="5" fontWeight="400" fontFamily="Arial, sans-serif">INTERNATIONAL</text>
    </svg>
  );
}

// ============================================
// PAYMENT MODAL
// ============================================
function PaymentModal({ isOpen, onClose, pkg, userEmail, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<PayMethod>("tigerpay");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [minpayInstructions, setMinpayInstructions] = useState<any>(null);
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
      setReference("");
      setMessage("");
      setFailReason("");
      setLoading(false);
      setPollCount(0);
      setScreenshot(null);
      setScreenshotPreview(null);
      setMinpayInstructions(null);
    }
  }, [isOpen]);

  // Poll for payment status
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
        if (data.status === "success") {
          clearInterval(interval);
          setStage("success");
          showToast(`Payment confirmed! ${data.txAmount ?? 0} SQ added.`, "success");
          onSuccess();
          return;
        }
        if (data.status === "failed") {
          clearInterval(interval);
          setStage("failed");
          setFailReason("Payment failed. Please try again.");
          return;
        }
        if (data.status === "abandoned" || data.status === "cancelled") {
          clearInterval(interval);
          setStage("failed");
          setFailReason("Payment was cancelled.");
          return;
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, reference, onSuccess, showToast]);

  // ============================================
  // TIGERPAY PAYMENT
  // ============================================
  const handleTigerPay = async () => {
    if (!pkg) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payments/tigerpay/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ packageId: pkg._id })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
        setLoading(false);
        return;
      }
      if (data.authorizationUrl) {
        setReference(data.reference);
        setMessage("Redirecting to TigerPay...");
        setStage("pending");
        window.open(data.authorizationUrl, "_blank");
      } else {
        showToast("Failed to initialize payment", "error");
        setLoading(false);
      }
    } catch {
      showToast("Failed to initiate payment", "error");
      setLoading(false);
    }
  };

  // ============================================
  // MINPAY PAYMENT (International)
  // ============================================
  const handleMinpay = async () => {
    if (!pkg) return;
    setLoading(true);
    try {
      const totalTx = pkg.txAmount + pkg.bonusTx;
      const res = await fetch("/api/payments/minpay/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ txAmount: totalTx })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
        setLoading(false);
        return;
      }
      setReference(data.reference);
      setMinpayInstructions(data.instructions);
      setStage("minpay_upload");
      setLoading(false);
    } catch {
      showToast("Failed to initiate MINPAY payment", "error");
      setLoading(false);
    }
  };

  // ============================================
  // MINPAY SCREENSHOT UPLOAD
  // ============================================
  const handleScreenshotUpload = async () => {
    if (!screenshot) {
      showToast("Please select a screenshot", "error");
      return;
    }
    if (!reference) {
      showToast("No reference found", "error");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("screenshot", screenshot);
      formData.append("reference", reference);
      formData.append("amount", String(minpayInstructions?.amount || 0));

      const res = await fetch("/api/payments/minpay/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast("Screenshot uploaded successfully! Waiting for admin verification.", "success");
        setStage("pending");
        setMessage("Screenshot uploaded. Admin will verify your payment.");
      } else {
        showToast(data.error || "Upload failed", "error");
      }
    } catch {
      showToast("Failed to upload screenshot", "error");
    }
    setLoading(false);
  };

  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;
  const SQ_RATE = 50; // 1 SQ = 50 TSh
  const amountTsh = totalTx * SQ_RATE;

  const methodOptions: { key: PayMethod; label: string; Logo: () => ReactElement; description: string }[] = [
    { key: "tigerpay", label: "TigerPay", Logo: TigerPayLogo, description: "Local - Auto" },
    { key: "minpay", label: "MINPAY", Logo: MinpayLogo, description: "International" },
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
            <p className="text-sm text-muted-foreground mt-1">{totalTx} SQ has been added to your account.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
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
      ) : stage === "minpay_upload" ? (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-purple-400" />
              <span className="font-semibold">International Payment</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Send payment via MINPAY then upload screenshot</p>
          </div>

          {minpayInstructions && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm space-y-1">
              <p className="font-semibold text-blue-400">Payment Instructions:</p>
              <p className="text-xs text-muted-foreground">Send to: <span className="font-mono font-semibold text-white">255787069580</span></p>
              <p className="text-xs text-muted-foreground">Name: <span className="font-semibold text-white">Masanyiwa Stanley</span></p>
              <p className="text-xs text-muted-foreground">Amount: <span className="font-semibold text-green-400">TSh {minpayInstructions.amount?.toLocaleString() || 0}</span></p>
              <p className="text-xs text-muted-foreground">Reference: <span className="font-mono text-xs">{reference}</span></p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1.5">Upload Screenshot</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setScreenshot(file);
                    setScreenshotPreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
                id="screenshot-upload"
              />
              <label
                htmlFor="screenshot-upload"
                className="flex-1 py-2.5 px-3 rounded-lg border border-dashed border-border text-center cursor-pointer hover:border-purple-500/40 transition-colors"
              >
                {screenshotPreview ? (
                  <div className="flex items-center justify-center gap-2">
                    <img src={screenshotPreview} alt="Screenshot" className="h-12 w-12 object-cover rounded" />
                    <span className="text-xs text-muted-foreground">{screenshot?.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <FileImage className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload screenshot</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <button
            onClick={handleScreenshotUpload}
            disabled={loading || !screenshot}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? "Uploading..." : "Upload Screenshot"}
          </button>

          <button
            onClick={() => setStage("select")}
            className="w-full py-2 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="font-bold text-purple-400">{totalTx} SQ</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">TSh {amountTsh.toLocaleString()} <span className="text-muted-foreground/60">≈ ${(amountTsh * 0.0004).toFixed(2)} USD</span></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {methodOptions.map(({ key, label, Logo, description }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 py-4 px-3 rounded-lg border transition-all ${method === key ? "border-purple-500/60 bg-purple-500/10" : "border-border hover:border-border/80"}`}
              >
                <Logo />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground/60">{description}</span>
              </button>
            ))}
          </div>

          {method === "tigerpay" && (
            <button
              onClick={handleTigerPay}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Processing..." : `Pay TSh ${amountTsh.toLocaleString()}`}
            </button>
          )}

          {method === "minpay" && (
            <button
              onClick={handleMinpay}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {loading ? "Processing..." : `Pay TSh ${amountTsh.toLocaleString()}`}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

// ============================================
// CUSTOM TX MODAL
// ============================================
function CustomTxModal({ isOpen, onClose, userEmail, onSuccess }: { isOpen: boolean; onClose: () => void; userEmail: string; onSuccess: () => void }) {
  const [txAmount, setTxAmount] = useState(10);
  const [method, setMethod] = useState<PayMethod>("tigerpay");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [minpayInstructions, setMinpayInstructions] = useState<any>(null);
  const { showToast } = useToast();

  const SQ_RATE = 50; // 1 SQ = 50 TSh
  const amountTsh = txAmount * SQ_RATE;
  const TX_MIN = 1;

  useEffect(() => {
    if (!isOpen) {
      setStage("select");
      setReference("");
      setMessage("");
      setFailReason("");
      setLoading(false);
      setPollCount(0);
      setTxAmount(10);
      setScreenshot(null);
      setScreenshotPreview(null);
      setMinpayInstructions(null);
    }
  }, [isOpen]);

  // Poll for payment status
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
        const data = await getMobileChargeStatus(reference) as { status?: string; txAmount?: number; error?: string };
        if (data.status === "success") {
          clearInterval(interval);
          setStage("success");
          showToast(`${data.txAmount ?? txAmount} SQ added!`, "success");
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
  }, [stage, reference, onSuccess, showToast, txAmount]);

  // ============================================
  // TIGERPAY CUSTOM
  // ============================================
  const handleTigerPayCustom = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/tigerpay/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ txAmount })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
        setLoading(false);
        return;
      }
      if (data.authorizationUrl) {
        setReference(data.reference);
        setMessage("Redirecting to TigerPay...");
        setStage("pending");
        window.open(data.authorizationUrl, "_blank");
      } else {
        showToast("Failed to initialize payment", "error");
        setLoading(false);
      }
    } catch {
      showToast("Failed to initiate payment", "error");
      setLoading(false);
    }
  };

  // ============================================
  // MINPAY CUSTOM
  // ============================================
  const handleMinpayCustom = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/minpay/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ txAmount })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
        setLoading(false);
        return;
      }
      setReference(data.reference);
      setMinpayInstructions(data.instructions);
      setStage("minpay_upload");
      setLoading(false);
    } catch {
      showToast("Failed to initiate MINPAY payment", "error");
      setLoading(false);
    }
  };

  // ============================================
  // MINPAY SCREENSHOT UPLOAD
  // ============================================
  const handleScreenshotUpload = async () => {
    if (!screenshot) {
      showToast("Please select a screenshot", "error");
      return;
    }
    if (!reference) {
      showToast("No reference found", "error");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("screenshot", screenshot);
      formData.append("reference", reference);
      formData.append("amount", String(minpayInstructions?.amount || amountTsh));

      const res = await fetch("/api/payments/minpay/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast("Screenshot uploaded successfully! Waiting for admin verification.", "success");
        setStage("pending");
        setMessage("Screenshot uploaded. Admin will verify your payment.");
      } else {
        showToast(data.error || "Upload failed", "error");
      }
    } catch {
      showToast("Failed to upload screenshot", "error");
    }
    setLoading(false);
  };

  const methodOptions: { key: PayMethod; label: string; Logo: () => ReactElement; description: string }[] = [
    { key: "tigerpay", label: "TigerPay", Logo: TigerPayLogo, description: "Local - Auto" },
    { key: "minpay", label: "MINPAY", Logo: MinpayLogo, description: "International" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom SQ Purchase" maxWidth="max-w-sm">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{txAmount} SQ added to your balance.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-red-400">Failed</p>
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
        </div>
      ) : stage === "minpay_upload" ? (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-purple-400" />
              <span className="font-semibold">International Payment</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Send payment via MINPAY then upload screenshot</p>
          </div>

          {minpayInstructions && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm space-y-1">
              <p className="font-semibold text-blue-400">Payment Instructions:</p>
              <p className="text-xs text-muted-foreground">Send to: <span className="font-mono font-semibold text-white">255787069580</span></p>
              <p className="text-xs text-muted-foreground">Name: <span className="font-semibold text-white">Masanyiwa Stanley</span></p>
              <p className="text-xs text-muted-foreground">Amount: <span className="font-semibold text-green-400">TSh {minpayInstructions.amount?.toLocaleString() || 0}</span></p>
              <p className="text-xs text-muted-foreground">Reference: <span className="font-mono text-xs">{reference}</span></p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1.5">Upload Screenshot</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setScreenshot(file);
                    setScreenshotPreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
                id="screenshot-upload-custom"
              />
              <label
                htmlFor="screenshot-upload-custom"
                className="flex-1 py-2.5 px-3 rounded-lg border border-dashed border-border text-center cursor-pointer hover:border-purple-500/40 transition-colors"
              >
                {screenshotPreview ? (
                  <div className="flex items-center justify-center gap-2">
                    <img src={screenshotPreview} alt="Screenshot" className="h-12 w-12 object-cover rounded" />
                    <span className="text-xs text-muted-foreground">{screenshot?.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <FileImage className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload screenshot</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <button
            onClick={handleScreenshotUpload}
            disabled={loading || !screenshot}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? "Uploading..." : "Upload Screenshot"}
          </button>

          <button
            onClick={() => setStage("select")}
            className="w-full py-2 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">How many SQ do you want?</p>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setTxAmount(v => Math.max(TX_MIN, v - 1))}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
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
                <p className="text-xs text-muted-foreground">SQ Coins</p>
              </div>
              <button
                onClick={() => setTxAmount(v => v + 1)}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-semibold">TSh {amountTsh.toLocaleString()} <span className="text-muted-foreground/60 text-xs">≈ ${(amountTsh * 0.0004).toFixed(2)} USD</span></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {methodOptions.map(({ key, label, Logo, description }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 py-4 px-3 rounded-lg border transition-all ${method === key ? "border-purple-500/60 bg-purple-500/10" : "border-border hover:border-border/80"}`}
              >
                <Logo />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground/60">{description}</span>
              </button>
            ))}
          </div>

          {method === "tigerpay" && (
            <button
              onClick={handleTigerPayCustom}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Processing..." : `Pay TSh ${amountTsh.toLocaleString()}`}
            </button>
          )}

          {method === "minpay" && (
            <button
              onClick={handleMinpayCustom}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {loading ? "Processing..." : `Pay TSh ${amountTsh.toLocaleString()}`}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

// ============================================
// MAIN TOPUP PAGE
// ============================================
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
    if (status === "success" && ref) {
      showToast("Payment confirmed! SQ added to your balance.", "success");
      refreshUser();
    } else if (status === "failed") {
      showToast("Payment failed or was cancelled.", "error");
    }
  }, [searchParams, showToast, refreshUser]);

  useEffect(() => {
    getPackages()
      .then(data => setPackages((data as Package[]).sort((a, b) => a.order - b.order)))
      .catch(() => showToast("Failed to load packages", "error"))
      .finally(() => setPkgLoading(false));
  }, [showToast]);

  if (loading) return <PageLoader />;

  const SQ_RATE = 50; // 1 SQ = 50 TSh

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

        {pkgLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3">
              {packages.map(pkg => {
                const total = pkg.txAmount + pkg.bonusTx;
                const amountTsh = total * SQ_RATE;
                return (
                  <div
                    key={pkg._id}
                    className={`relative w-full p-4 rounded-xl border transition-all hover:border-purple-500/40 hover:bg-purple-500/5 ${pkg.isBestDeal ? "border-purple-500/50 bg-purple-500/5" : "border-border bg-card/50"}`}
                  >
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
                        <p className="text-sm text-muted-foreground">TSh {amountTsh.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => { setSelectedPkg(pkg); setModalOpen(true); }}
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
                  onClick={() => setCustomModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors border border-border"
                >
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