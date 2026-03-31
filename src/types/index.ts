export interface UserProfile {
  id: string;
  name: string;
  email: string;
  balance: number;
  upiId: string;
  accountNumber: string;
  aadhaarId: string;
  upiCustom: boolean;
  upiSubscriptionEnd: number;
  uiSubscriptionEnd: number;
  depositCount: number;
  depositResetTime: number;
  lastBillingTime: number;
  createdAt: number;
  holdings?: { [assetId: string]: number };
  premiumTheme?: 'midnight' | 'emerald' | 'ruby' | 'gold' | 'neon' | 'sunset' | 'ocean' | 'cyber';
  pin?: string;
  isGamePaused?: boolean;
  gamePauseEndTime?: number;
  withdrawCount?: number;
  withdrawResetTime?: number;
  groupId?: string;
  isBanned?: boolean;
  role?: 'admin' | 'user';
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  members: string[]; // User IDs
  pendingInvites: string[]; // Aadhaar numbers
  isPaused: boolean;
  pausedBy?: string; // User ID who triggered the pause
  resumedBy?: string[]; // User IDs who entered their PIN
  marketPrices?: { [assetId: string]: number };
  createdAt: number;
}

export interface Loan {
  id: string;
  borrowerId: string;
  lenderId: string; // 'BANK' or User ID
  principal: number;
  interestRate: number;
  duration: number; // In minutes (max 60 for bank)
  startTime: number;
  nextPaymentTime: number;
  status: 'active' | 'paid' | 'defaulted' | 'banned';
  missedPayments: number;
  fine: number;
  lenderPinRequired?: boolean;
  totalRepaid: number;
  monthlyInstallment: number;
}

export interface MarketProduct {
  id: string;
  sellerId: string;
  groupId: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  createdAt: number;
}

export interface AadhaarRecord {
  id: string;
  aadhaarNumber: string;
  userId: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  timestamp: number;
  senderName?: string;
  receiverName?: string;
  type?: 'transfer' | 'tax' | 'fee' | 'buy' | 'sell' | 'withdraw';
  assetId?: string;
  assetName?: string;
  assetPrice?: number;
  note?: string;
  loanId?: string;
}

export interface SystemStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: number;
  bankBalance: number;
  activeLoans: number;
  totalLoansDisbursed: number;
  lastUpdated: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}
