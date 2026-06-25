import { ArrowLeft, Zap, BookOpen, Shield, Repeat2, Gift, Users, HelpCircle, ChevronDown, ChevronRight, Server, Crown } from "lucide-react";
  import { useState } from "react";
  import { useNavLoader } from "@/App";
  import { TechBackground } from "@/components/TechBackground";

  interface FAQItem { q: string; a: string; }
  interface Section { icon: React.ComponentType<{ className?: string }>; title: string; items: FAQItem[]; }

  const sections: Section[] = [
    {
      icon: Zap,
      title: "Getting Started",
      items: [
        { q: "How do I deploy a bot?", a: "From your dashboard, go to Services → Bot Deployment. Browse the available bot templates and click 'Deploy' on the one you want. On the deploy page: get your session ID (Step 1), enter a bot name of at least 5 letters (Step 2), paste your session ID (Step 3), choose your device mode (Step 4), then click Deploy. Your bot builds in roughly 2 minutes." },
        { q: "Where do I get a session ID?", a: "Each bot template has a 'Get Session ID' button that opens the pairing page. Follow the pairing process and you'll receive a long session string — copy and paste the entire value into the deploy form." },
        { q: "What's the difference between Android and iOS device?", a: "Android enables interactive buttons (list menus, quick-reply buttons). iOS uses text-only responses. Choose based on your bot's feature set — Android is recommended for most use cases." },
        { q: "How much does hosting cost?", a: "Most bots cost 10 TX per month. Some premium templates may cost more — the cost is shown clearly on each bot's deploy page before you confirm. 10 TX = 1 month of hosting for one bot." },
        { q: "Can I deploy multiple bots?", a: "Yes. You can deploy as many bots as your TX balance allows, and manage them all from the My Bots page." },
      ]
    },
    {
      icon: Repeat2,
      title: "Managing Your Bot",
      items: [
        { q: "How do I restart or stop my bot?", a: "From My Bots, each bot card has Start, Stop, and Restart buttons. Use these to control your bot's lifecycle." },
        { q: "How do I update my session ID?", a: "Click 'Edit' on your bot card, enter the new session string, and save. This is useful if WhatsApp logs you out." },
        { q: "How do I view logs?", a: "Click the 'Logs' button on any bot card. This shows recent application output to help you debug issues." },
        { q: "My bot stopped working after a WhatsApp update — what do I do?", a: "Generate a new session using the pairing link for your bot, then update your bot via the Edit button. This usually resolves connection issues." },
        { q: "How do I share my bot's deploy page with someone?", a: "On the Bot Deployment page, each bot template has a 'Copy link' button. Share that link and it opens the deploy page for that specific bot directly." },
      ]
    },
    {
      icon: Zap,
      title: "TX Coins & Billing",
      items: [
        { q: "What are TX Coins?", a: "TX is the in-app currency used to pay for bot hosting and panels. 10 TX = 1 month of hosting for one bot. TX never expires." },
        { q: "How do I buy TX?", a: "Go to the Top Up page. Choose a package and pay via M-Pesa, Airtel Money, or Credit/Debit Card. TX is added instantly after confirmation." },
        { q: "What is the cheapest option?", a: "The Starter pack gives you the minimum TX needed to deploy a bot. The Best Deal pack gives the most TX per shilling." },
        { q: "Do TX coins expire?", a: "No — your TX balance never expires. Use it whenever you need to deploy or renew." },
      ]
    },
    {
      icon: Gift,
      title: "Coupons",
      items: [
        { q: "Where do I enter a coupon code?", a: "From the dashboard, click 'Coupon Code'. Enter the code you received and click Claim." },
        { q: "Where can I find coupon codes?", a: "Coupon codes are shared in the Toxic Bot WhatsApp groups and occasionally on social media. Keep an eye out!" },
        { q: "Can I use the same coupon twice?", a: "No. Each coupon can only be claimed once, by one account." },
      ]
    },
    {
      icon: Users,
      title: "Referrals",
      items: [
        { q: "How do referrals work?", a: "Share your unique referral link from the dashboard. When someone signs up using your link, you both earn 2 TX automatically." },
        { q: "Are there restrictions on referrals?", a: "Yes — accounts created from the same IP address or device as yours do not qualify for referral rewards. This prevents self-referrals." },
        { q: "When do I receive my referral TX?", a: "Instantly, as soon as your referral creates an account. No delays, no waiting." },
      ]
    },
    {
      icon: Server,
      title: "Panel Hosting",
      items: [
        { q: "What is a hosting panel?", a: "A hosting panel (Pterodactyl) gives you a full server environment with console access, file manager, and real-time resource monitoring. You can run any Node.js app or WhatsApp bot on it directly." },
        { q: "How do I buy a panel?", a: "Go to Services → Panels → Purchase Panels. Choose a plan and click Purchase. TX is deducted instantly and your panel credentials (username & password) are shown immediately. Save them — they are only shown once." },
        { q: "How do I access my panels?", a: "Go to Services → Panels → My Panels (or visit the My Panels page from the sidebar). Each panel entry has an 'Open Panel' button that takes you directly to the login page." },
        { q: "Are there any recurring fees for panels?", a: "No. Panel purchases are one-time — you pay TX once and you keep access. There are no monthly renewals for panels." },
        { q: "Can I delete my panel record?", a: "Yes — in My Panels, each panel has a 'Remove' button. This removes the saved credentials from your account. Your actual server access on the panel remains unchanged." },
      ]
    },
    {
      icon: Crown,
      title: "Admin Panel Access",
      items: [
        { q: "What is the Admin Panel package?", a: "The Admin Panel package (40 TX) gives your account full administrator privileges on the Pterodactyl game panel. As an admin you can manage all servers, users, nodes, and allocations directly from the panel dashboard." },
        { q: "How do I purchase admin access?", a: "Go to Services → Panels → Purchase Panels and scroll to the Admin Panel card. Click Purchase (costs 40 TX). Your admin credentials are shown immediately after — save them securely." },
        { q: "Can I use admin access alongside a regular panel plan?", a: "Yes. Admin access is independent. You can also hold regular panel server plans at the same time." },
      ]
    },
    {
      icon: Shield,
      title: "Account & Security",
      items: [
        { q: "I forgot my password — how do I reset it?", a: "Contact support via xhclinton.me/contact with your email or username. An admin will reset your password." },
        { q: "My account was banned — what should I do?", a: "Contact support with your account details. Bans are issued for ToS violations. If you believe it's an error, we'll review it." },
        { q: "Is my session ID safe?", a: "Your session ID is stored encrypted and used only to connect your bot to WhatsApp. We do not share or expose it." },
      ]
    },
    {
      icon: HelpCircle,
      title: "Troubleshooting",
      items: [
        { q: "My bot shows 'stopped' but I haven't stopped it", a: "WhatsApp may have disconnected the session. Go to Edit on your bot card, generate a new session using the bot's pairing link, paste it in, and click Save. Then restart the bot." },
        { q: "The deploy page is blank when I open a bot link", a: "Try refreshing the page. If you're not logged in, you'll be redirected to login first — then navigate back to the bot link. Make sure the bot template link is correct." },
        { q: "Logs show an error I don't understand", a: "Copy the error and contact support. Include your bot name and what the error says." },
        { q: "The page goes blank when I press Back on my phone", a: "Try tapping the on-screen back arrow instead of the phone's hardware back button. If a page still goes blank, refresh — you'll be taken to the correct page." },
      ]
    },
  ];

  function FAQCard({ q, a }: FAQItem) {
    const [open, setOpen] = useState(false);
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setOpen(!open)}
        >
          <span className="text-sm font-medium pr-4">{q}</span>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>
        {open && (
          <div className="px-4 pb-4 pt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
          </div>
        )}
      </div>
    );
  }

  export function Docs() {
      const { navigateWithLoader } = useNavLoader();
      const [search, setSearch] = useState("");

      const filtered = search.trim()
        ? sections.flatMap(section =>
            section.items
              .filter(item => item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase()))
              .map(item => ({ ...item, sectionTitle: section.title, SectionIcon: section.icon }))
          )
        : null;

      return (
        <div className="min-h-screen bg-background relative">
          <TechBackground />
          <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
            <div className="max-w-2xl mx-auto px-4">
              <div className="flex items-center h-14 gap-3">
                <button onClick={() => navigateWithLoader("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" aria-label="Back">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <h1 className="font-bold text-base">Documentation & FAQ</h1>
                </div>
              </div>
            </div>
          </nav>

          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 relative z-[1]">
            <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/20 p-5">
              <h2 className="font-bold text-lg mb-1">Toxic Host Documentation</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Everything you need to deploy, manage, and troubleshoot your WhatsApp bots and game server panels. Can't find an answer?
              </p>
              <button
                onClick={() => navigateWithLoader("/contact")}
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 text-xs font-medium transition-colors border border-purple-500/20"
              >
                Contact Support
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search documentation..."
                className="w-full px-4 py-2.5 pl-10 rounded-lg border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {filtered !== null ? (
              filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No results found for "<span className="text-foreground">{search}</span>"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((item, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                        <item.SectionIcon className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{item.sectionTitle}</span>
                      </div>
                      <div className="px-4 pb-3">
                        <p className="text-sm font-medium mb-1">{item.q}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                {sections.map(section => (
                  <div key={section.title} className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <section.icon className="w-4 h-4 text-purple-400" />
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{section.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {section.items.map(item => (
                        <FAQCard key={item.q} {...item} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="rounded-xl bg-card border border-border p-5 text-center">
              <p className="text-sm font-medium mb-1">Still need help?</p>
              <p className="text-xs text-muted-foreground mb-3">Our support team is available via the contact page.</p>
              <button
                onClick={() => navigateWithLoader("/contact")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm font-medium transition-colors"
              >
                Get Support
              </button>
            </div>
          </div>
        </div>
      );
    }
    