import { useState } from "react";
import { Modal } from "./Modal";
import { Users, Copy, Check } from "lucide-react";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string;
}

export function ReferralModal({ isOpen, onClose, referralCode }: ReferralModalProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const referralUrl = `${window.location.origin}/signup?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = referralUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join Toxic Host",
      text: "Get free TX coins when you sign up for Toxic Host using my referral link!",
      url: referralUrl
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } catch {}
    } else {
      await handleCopy();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Refer & Earn" maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-5 py-2">
        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Users className="w-7 h-7 text-purple-400" />
        </div>
        <div className="text-center">
          <p className="font-semibold mb-1">Invite friends, earn TX</p>
          <p className="text-muted-foreground text-sm">
            Share your link — every friend who signs up gives you <span className="text-purple-400 font-medium">2 TX</span>, and your friend also gets <span className="text-purple-400 font-medium">2 TX</span> as a welcome bonus.
          </p>
        </div>

        {referralCode ? (
          <div className="w-full space-y-3">
            <div className="bg-muted rounded-lg px-3 py-2.5 text-sm truncate text-muted-foreground font-mono border border-border w-full">
              {referralUrl}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  copied
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-muted border border-border text-foreground hover:bg-muted/80"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  shared
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {shared ? (
                  <>
                    <Check className="w-4 h-4" />
                    Shared
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full p-3 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
            Loading your referral link...
          </div>
        )}

        <div className="w-full p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-muted-foreground text-center space-y-1">
          <p>Same IP or device signups do not qualify for rewards</p>
          <p className="text-purple-400 mt-1">Referral rewards are instant — no delays</p>
        </div>
      </div>
    </Modal>
  );
}
