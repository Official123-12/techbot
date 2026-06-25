export interface User {
      id: string;
      email: string;
      username?: string;
      txCoins: number;
      isBanned?: boolean;
      referralCode?: string;
      usedFreeTrial?: boolean;
    }

    export interface Bot {
      _id: string;
      userId: string;
      herokuAppName: string;
      phoneNumber: string;
      sessionVar: string;
      deployedAt: string;
      expiresAt: string;
      gracePeriodEnd: string | null;
      isTrial: boolean;
      status: "building" | "running" | "stopped" | "expired" | "deleted";
      teamName: string;
      templateId?: string;
      templateName?: string;
      isDefault?: boolean;
    }

    export interface Transaction {
      _id: string;
      userId: string;
      type: "topup" | "deploy" | "panel" | "renew" | "refund" | "admin_grant";
      txAmount: number;
      ksAmount: number;
      paystackRef: string;
      status: "pending" | "success" | "failed";
      createdAt: string;
    }

    export interface Package {
      _id: string;
      name: string;
      ksPrice: number;
      txAmount: number;
      bonusTx: number;
      isBestDeal: boolean;
      order: number;
    }

    export interface Coupon {
      _id: string;
      code: string;
      txAmount: number;
      claimedBy: string | null;
      claimedAt: string | null;
      createdAt: string;
    }

    export interface Referral {
      _id: string;
      referrerEmail: string;
      referrerUsername: string;
      referredEmail: string;
      referredUsername: string;
      txRewarded: number;
      createdAt: string;
    }

    export interface AdminUser {
      _id: string;
      email: string;
      username: string;
      txCoins: number;
      botCount: number;
      isBanned: boolean;
      banReason: string;
      referralCode: string;
      createdAt: string;
    }

    export interface AdminBot {
      _id: string;
      herokuAppName: string;
      phoneNumber: string;
      ownerEmail: string;
      ownerUsername: string;
      status: string;
      teamName: string;
      expiresAt: string;
    }

    export interface AdminStats {
      totalUsers: number;
      totalBots: number;
      activeBots: number;
      totalRevenue: number;
      totalTxInCirculation: number;
      totalTransactions: number;
      totalCoupons: number;
      claimedCoupons: number;
      totalReferrals: number;
      totalPanels: number;
    }

    export interface HerokuTeam {
      _id: string;
      name: string;
      billingLabel: string;
      active: boolean;
      appCount?: number;
      isFull?: boolean;
    }

    export interface DbCollectionStat {
      name: string;
      label: string;
      count: number;
      canPurge: boolean;
    }

    export interface DbStats {
      collections: DbCollectionStat[];
      storage?: {
        dataSize: number;
        storageSize: number;
        totalSize: number;
      } | null;
      quota?: {
        quotaMb: number;
        usedMb: number;
        remainingMb: number;
        usedPercent: number;
      } | null;
    }

    export interface BotTemplate {
      _id: string;
      name: string;
      githubRepo: string;
      sessionIdUrl: string;
      imageUrl: string;
      isDefault: boolean;
      shareableSlug: string;
      costTx: number;
      active: boolean;
      order: number;
      createdAt: string;
    }

    export interface UserPanel {
      _id: string;
      userId: string;
      planName: string;
      panelUsername: string;
      panelPassword: string;
      panelLoginUrl: string;
      txCost: number;
      purchasedAt: string;
      expiresAt: string | null;
    }

    export interface PanelPlan {
      _id: string;
      name: string;
      description: string;
      txCost: number;
      originalTxCost: number;
      ram: string;
      disk: string;
      cpu: string;
      isBestDeal: boolean;
      active: boolean;
      order: number;
    }

    export interface Tutorial {
      _id: string;
      title: string;
      youtubeUrl: string;
      order: number;
      createdAt: string;
    }
  