import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  Link
} from 'react-router-dom';
import { 
  Wallet, 
  ArrowRightLeft, 
  History, 
  User as UserIcon, 
  ShieldCheck, 
  CreditCard, 
  PlusCircle, 
  Crown, 
  LogOut,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Settings,
  Palette,
  Lock,
  ArrowUpRight,
  Users,
  Landmark,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInAnonymously, signOut } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  or,
  doc
} from 'firebase/firestore';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { auth, db } from './lib/firebase';
import { PinModal } from './components/PinModal';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { EconomyProvider, useEconomy } from './components/EconomyProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { bankService } from './services/bankService';
import { UserProfile, Transaction, AadhaarRecord, Group, Loan, MarketProduct, OperationType, SystemStats } from './types';
import { handleFirestoreError, parseFirestoreError } from './lib/error-handler';
import { cn } from './lib/utils';
import { FriendsTab } from './components/FriendsTab';
import { LoanSection } from './components/LoanSection';

// --- Constants ---

const THEME_GRADIENTS = {
  midnight: "from-gray-900 to-black",
  emerald: "from-emerald-950 to-black",
  ruby: "from-red-950 to-black",
  gold: "from-amber-950 to-black",
  neon: "from-purple-950 to-black",
  sunset: "from-orange-950 to-black",
  ocean: "from-cyan-950 to-black",
  cyber: "from-lime-950 to-black"
};

const THEME_ACCENTS = {
  midnight: "text-blue-400",
  emerald: "text-emerald-400",
  ruby: "text-red-400",
  gold: "text-amber-400",
  neon: "text-fuchsia-400",
  sunset: "text-orange-400",
  ocean: "text-cyan-400",
  cyber: "text-lime-400"
};

const THEME_BORDERS = {
  midnight: "border-blue-500/20",
  emerald: "border-emerald-500/20",
  ruby: "border-red-500/20",
  gold: "border-amber-500/20",
  neon: "border-purple-500/20",
  sunset: "border-orange-500/20",
  ocean: "border-cyan-500/20",
  cyber: "border-lime-500/20"
};

const THEME_BLURS = {
  midnight: "bg-blue-500/5",
  emerald: "bg-emerald-500/5",
  ruby: "bg-red-500/5",
  gold: "bg-amber-500/5",
  neon: "bg-purple-500/5",
  sunset: "bg-orange-500/5",
  ocean: "bg-cyan-500/5",
  cyber: "bg-lime-500/5"
};

const THEME_NAV_STYLES = {
  midnight: "border-white/10 text-blue-400",
  emerald: "border-emerald-500/20 text-emerald-400",
  ruby: "border-red-500/20 text-red-400",
  gold: "border-amber-500/20 text-amber-400",
  neon: "border-purple-500/20 text-fuchsia-400",
  sunset: "border-orange-500/20 text-orange-400",
  ocean: "border-cyan-500/20 text-cyan-400",
  cyber: "border-lime-500/20 text-lime-400"
};

const THEME_ICON_COLORS = {
  midnight: "text-blue-400",
  emerald: "text-emerald-400",
  ruby: "text-red-400",
  gold: "text-amber-400",
  neon: "text-fuchsia-400",
  sunset: "text-orange-400",
  ocean: "text-cyan-400",
  cyber: "text-lime-400"
};

const THEME_CHART_COLORS = {
  midnight: "#3b82f6",
  emerald: "#10b981",
  ruby: "#ef4444",
  gold: "#f59e0b",
  neon: "#d946ef",
  sunset: "#f97316",
  ocean: "#06b6d4",
  cyber: "#84cc16"
};

// --- Components ---



const Navbar = () => {
  const { user, profile } = useFirebase();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (!user || !profile) return null;

  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();
  const theme = profile.premiumTheme || 'midnight';

  return (
    <nav className={cn(
      "sticky top-0 z-50 transition-all duration-500",
      isPremiumUI 
        ? "bg-black/80 backdrop-blur-2xl border-b" 
        : "bg-white border-b border-gray-200",
      isPremiumUI && THEME_NAV_STYLES[theme].split(' ')[0]
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/dashboard')}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
              isPremiumUI ? "bg-white/10 text-white group-hover:bg-white group-hover:text-black" : "bg-blue-600 text-white"
            )}>
              <Wallet className={cn("w-6 h-6", isPremiumUI && THEME_ICON_COLORS[theme])} />
            </div>
            <span className={cn(
              "text-xl font-black tracking-tighter transition-colors duration-500",
              isPremiumUI ? "text-white" : "text-gray-900"
            )}>
              FIN<span className={cn(isPremiumUI ? THEME_ACCENTS[theme] : "text-blue-600")}>TECH</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            {[
              { to: "/dashboard", label: "Dashboard" },
              { to: "/transfer", label: "Transfer" },
              { to: "/transactions", label: "History" },
              { to: "/market", label: "Market" },
              { to: "/friends", label: "Friends" },
              { to: "/loans", label: "Loans" },
              ...(profile.role === 'admin' ? [{ to: "/system", label: "System" }] : []),
              { to: "/premium", label: "Premium" },
              { to: "/settings", label: "Settings" }
            ].map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                className={cn(
                  "font-medium transition-colors",
                  isPremiumUI 
                    ? "text-gray-400 hover:text-white" 
                    : "text-gray-600 hover:text-blue-600"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className={cn("text-sm font-medium", isPremiumUI ? "text-white" : "text-gray-900")}>{profile.name}</p>
              <p className="text-xs text-gray-500">{profile.upiId}</p>
            </div>
            <button 
              onClick={handleLogout}
              className={cn(
                "p-2 transition-colors",
                isPremiumUI ? "text-gray-500 hover:text-red-400" : "text-gray-400 hover:text-red-600"
              )}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading PayBank...</p>
    </div>
  </div>
);

// --- Pages ---

const LandingPage = () => {
  const { user, profile, loading: firebaseLoading } = useFirebase();
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!firebaseLoading && user) {
      if (profile) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  }, [user, profile, firebaseLoading, navigate]);

  const handleLogin = async () => {
    setLoginLoading(true);
    setError('');
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error('Login error:', error);
      setError(parseFirestoreError(error) || 'Failed to sign in. Please check your Firebase configuration.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center"
      >
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-200">
          <Wallet className="text-white w-10 h-10" />
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 tracking-tight">
          The Future of <span className="text-blue-600">Simulated</span> Banking
        </h1>
        <p className="text-xl text-gray-600 mb-10 leading-relaxed">
          Experience a high-speed digital economy. Manage your fake wealth, 
          transfer funds instantly, and grow your simulated empire.
        </p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-10 flex items-start gap-3 text-left">
          <AlertCircle className="text-amber-600 w-6 h-6 shrink-0 mt-0.5" />
          <p className="text-amber-800 text-sm">
            <span className="font-bold">Disclaimer:</span> This is a simulated banking system. 
            No real money is involved. All transactions and balances are for gameplay purposes only.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 text-left max-w-md mx-auto">
            <AlertCircle className="text-red-600 w-6 h-6 shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">
              {error}
            </p>
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={loginLoading || firebaseLoading}
          className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginLoading ? 'Connecting...' : 'Start Banking Now'}
          {!loginLoading && <ArrowRightLeft className="w-5 h-5" />}
        </button>
      </motion.div>
    </div>
  );
};

const OnboardingPage = () => {
  const { user, profile } = useFirebase();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarId, setAadhaarId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) navigate('/dashboard');
  }, [profile, navigate]);

  const handleSignup = async (e: React.FormEvent, id: string, isGenerated: boolean) => {
    e.preventDefault();
    if (!name || !email || !id) return;
    setLoading(true);
    setError('');
    try {
      await bankService.signup(name, email, id, isGenerated);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(parseFirestoreError(err) || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAadhaarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaar.length !== 12) return;
    setLoading(true);
    setError('');
    try {
      // Try to login with this Aadhaar first
      const existingProfile = await bankService.loginWithAadhaar(aadhaar);
      if (existingProfile) {
        // Account found and linked!
        navigate('/dashboard');
        return;
      }

      // No existing account, proceed with verification
      const record = await bankService.createAadhaar(aadhaar);
      setStep(3);
      setAadhaarId(record.id);
    } catch (err: any) {
      console.error(err);
      setError(parseFirestoreError(err) || 'Aadhaar verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAadhaar = async () => {
    setLoading(true);
    setError('');
    try {
      const record = await bankService.createAadhaar();
      setStep(4); // Generated path
      setAadhaarId(record.id);
      setAadhaar(record.aadhaarNumber);
    } catch (err: any) {
      console.error(err);
      setError(parseFirestoreError(err) || 'Aadhaar generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <ShieldCheck className="text-blue-600 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {step <= 2 ? 'Identity Verification' : 'Account Details'}
            </h2>
            <p className="text-sm text-gray-500">
              {step <= 2 ? 'Aadhaar required for PayBank' : 'Complete your profile'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
            <AlertCircle className="text-red-600 w-6 h-6 shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">
              {error}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <p className="text-gray-600 leading-relaxed">
              To open your simulated bank account, you need a valid 12-digit Aadhaar number.
            </p>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setStep(2)}
                className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left group"
              >
                <p className="font-bold text-gray-900 group-hover:text-blue-600">Enter Aadhaar</p>
                <p className="text-sm text-gray-500">I have my 12-digit number</p>
              </button>
              <button 
                onClick={handleGenerateAadhaar}
                disabled={loading}
                className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 group-hover:text-blue-600">Generate Aadhaar</p>
                    <p className="text-sm text-gray-500">Cost: ₹99 (from starting balance)</p>
                  </div>
                  <div className="text-blue-600 font-bold">₹99</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleAadhaarSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">12-Digit Aadhaar Number</label>
              <input 
                type="text"
                maxLength={12}
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                placeholder="0000 0000 0000"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-center text-2xl tracking-widest font-mono"
                required
              />
            </div>
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button 
                type="submit"
                disabled={aadhaar.length !== 12 || loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        )}

        {(step === 3 || step === 4) && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Verified Aadhaar Number</p>
              <p className="text-xl font-mono font-bold text-blue-900 tracking-widest">
                {aadhaar.replace(/(\d{4})/g, '$1 ').trim()}
              </p>
            </div>
            
            <form onSubmit={(e) => handleSignup(e, aadhaarId, step === 4)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Finish Setup'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const { profile } = useFirebase();
  const { billingCountdown, economyStats, marketData } = useEconomy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'transactions'),
      or(
        where('senderId', '==', profile.id),
        where('receiverId', '==', profile.id)
      ),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    return () => unsubscribe();
  }, [profile]);

  if (!profile) return <LoadingScreen />;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();
  const theme = profile.premiumTheme || 'midnight';

  // Simulated Net Worth Data
  const netWorthData = [
    { name: 'Mon', value: profile.balance * 0.8 },
    { name: 'Tue', value: profile.balance * 0.85 },
    { name: 'Wed', value: profile.balance * 0.82 },
    { name: 'Thu', value: profile.balance * 0.9 },
    { name: 'Fri', value: profile.balance * 0.95 },
    { name: 'Sat', value: profile.balance * 0.98 },
    { name: 'Sun', value: profile.balance },
  ];

  return (
    <div className={cn(
      "min-h-screen transition-all duration-700",
      isPremiumUI ? "bg-[#020202] text-white" : "bg-gray-50 text-gray-900"
    )}>
      {isPremiumUI && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className={cn("absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse", THEME_BLURS[theme])}></div>
          <div className={cn("absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse delay-1000", THEME_BLURS[theme])}></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "text-5xl font-bold tracking-tighter mb-2",
                isPremiumUI ? "text-white" : "text-gray-900"
              )}
            >
              Welcome back, {profile.name.split(' ')[0]}
            </motion.h2>
            <p className={isPremiumUI ? "text-gray-400" : "text-gray-500"}>
              Your simulated financial empire is growing.
            </p>
          </div>
          
          {isPremiumUI && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn("flex items-center gap-4 bg-white/5 backdrop-blur-xl border p-4 rounded-2xl", THEME_BORDERS[theme])}
            >
              <div className="text-right">
                <p className={cn("text-[10px] uppercase tracking-widest font-bold", THEME_ACCENTS[theme])}>Premium Status</p>
                <p className="text-sm font-bold">Active Tier: Elite</p>
              </div>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isPremiumUI ? "bg-white/5" : "bg-amber-400/20")}>
                <Crown className={cn("w-6 h-6", THEME_ACCENTS[theme])} />
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Balance Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-[3rem] p-12 relative overflow-hidden lg:col-span-2 shadow-2xl transition-all duration-500",
              isPremiumUI 
                ? cn("bg-gradient-to-br border", THEME_GRADIENTS[theme], THEME_BORDERS[theme]) 
                : "bg-blue-600 text-white shadow-blue-200"
            )}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-20">
                <div>
                  <p className={cn(
                    "text-xs font-bold mb-3 uppercase tracking-[0.2em]",
                    isPremiumUI ? "text-gray-500" : "text-blue-100"
                  )}>Available Balance</p>
                  <h2 className={cn(
                    "text-7xl font-bold tracking-tighter",
                    isPremiumUI ? "text-white" : "text-white"
                  )}>{formatCurrency(profile.balance)}</h2>
                </div>
                <div className={cn(
                  "p-5 rounded-3xl backdrop-blur-md",
                  isPremiumUI ? "bg-white/5 border border-white/10" : "bg-white/20"
                )}>
                  <Wallet className="w-10 h-10" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                <div>
                  <p className={cn("text-[10px] mb-2 uppercase tracking-widest font-bold", isPremiumUI ? "text-gray-500" : "text-blue-100")}>Account</p>
                  <p className="font-mono font-bold text-xl">{profile.accountNumber}</p>
                </div>
                <div>
                  <p className={cn("text-[10px] mb-2 uppercase tracking-widest font-bold", isPremiumUI ? "text-gray-500" : "text-blue-100")}>UPI ID</p>
                  <p className="font-bold text-xl">{profile.upiId}</p>
                </div>
                <div>
                  <p className={cn("text-[10px] mb-2 uppercase tracking-widest font-bold", isPremiumUI ? "text-gray-500" : "text-blue-100")}>Deposits</p>
                  <p className="font-bold text-xl">{profile.depositCount}/5</p>
                </div>
                <div>
                  <p className={cn("text-[10px] mb-2 uppercase tracking-widest font-bold", isPremiumUI ? "text-gray-500" : "text-blue-100")}>Billing</p>
                  <div className="flex items-center gap-2 font-bold text-xl">
                    <Clock className="w-6 h-6" />
                    {Math.floor(billingCountdown / 60)}:{(billingCountdown % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative Elements */}
            {isPremiumUI ? (
              <>
                <div className={cn("absolute top-0 right-0 w-[500px] h-[500px] rounded-full -mr-64 -mt-64 blur-[120px] opacity-20", THEME_BLURS[theme])}></div>
                <div className={cn("absolute bottom-0 left-0 w-80 h-80 rounded-full -ml-40 -mb-40 blur-[100px] opacity-10", THEME_BLURS[theme])}></div>
              </>
            ) : (
              <>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-24 -mb-24 blur-2xl"></div>
              </>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "rounded-[2.5rem] p-8 shadow-sm",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}
          >
            <h3 className={cn("text-lg font-bold mb-6", isPremiumUI ? "text-white" : "text-gray-900")}>Quick Actions</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { to: "/transfer", icon: ArrowRightLeft, label: "Send", color: "blue" },
                { to: "/deposit", icon: PlusCircle, label: "Deposit", color: "green" },
                { to: "/withdraw", icon: ArrowUpRight, label: "Withdraw", color: "orange" },
                { to: "/friends", icon: Users, label: "Friends", color: "indigo" },
                { to: "/loans", icon: Landmark, label: "Loans", color: "rose" },
                { to: "/premium", icon: Crown, label: "Premium", color: "amber" },
                { to: "/transactions", icon: History, label: "History", color: "purple" },
                { to: "/market", icon: TrendingUp, label: "Market", color: "emerald" }
              ].map((action) => (
                <Link 
                  key={action.to}
                  to={action.to} 
                  className={cn(
                    "flex flex-col items-center gap-3 p-5 rounded-3xl transition-all group",
                    isPremiumUI 
                      ? "bg-white/5 hover:bg-white/10" 
                      : "bg-gray-50 hover:bg-blue-50"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center transition-transform group-hover:scale-110",
                    isPremiumUI ? "bg-white/5" : "bg-white"
                  )}>
                    <action.icon className={cn("w-6 h-6", isPremiumUI ? "text-white" : "text-gray-700")} />
                  </div>
                  <span className={cn("text-xs font-bold", isPremiumUI ? "text-gray-400" : "text-gray-700")}>{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Economy Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "rounded-[2.5rem] p-8 shadow-sm lg:col-span-1",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}
          >
            <h3 className={cn("text-lg font-bold mb-6", isPremiumUI ? "text-white" : "text-gray-900")}>Economy Pulse</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Total Circulation</p>
                <p className="text-2xl font-bold">{formatCurrency(economyStats.totalCirculation)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={cn("p-4 rounded-2xl", isPremiumUI ? "bg-white/5" : "bg-gray-50")}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Users</p>
                  <p className="text-xl font-bold">{economyStats.totalUsers}</p>
                </div>
                <div className={cn("p-4 rounded-2xl", isPremiumUI ? "bg-white/5" : "bg-gray-50")}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Avg Bal</p>
                  <p className="text-xl font-bold">₹{Math.floor(economyStats.averageBalance)}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Market Data */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "rounded-[2.5rem] p-8 shadow-sm lg:col-span-2",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className={cn("text-lg font-bold", isPremiumUI ? "text-white" : "text-gray-900")}>Simulated Markets</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live Updates
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {marketData.map((asset) => (
                <div 
                  key={asset.id}
                  className={cn(
                    "p-5 rounded-3xl flex flex-col justify-between gap-4",
                    isPremiumUI ? "bg-white/5 border border-white/5" : "bg-gray-50"
                  )}
                >
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{asset.name}</p>
                    <p className="text-2xl font-bold">₹{asset.price}</p>
                  </div>
                  <div className={cn(
                    "text-sm font-bold flex items-center gap-1",
                    asset.change >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {asset.change >= 0 ? '+' : ''}{asset.change}%
                    <TrendingUp className={cn("w-4 h-4", asset.change < 0 && "rotate-180")} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Transactions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              "rounded-[2.5rem] p-8 shadow-sm lg:col-span-3",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className={cn("text-lg font-bold", isPremiumUI ? "text-white" : "text-gray-900")}>Recent Activity</h3>
              <Link to="/transactions" className="text-blue-600 text-sm font-bold hover:underline">View All History</Link>
            </div>
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500 italic">No transactions recorded yet.</div>
              ) : (
                transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className={cn(
                      "flex items-center justify-between p-5 rounded-3xl transition-colors",
                      isPremiumUI ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                    )}
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        tx.type === 'tax' ? (isPremiumUI ? "bg-amber-500/10 text-amber-500" : "bg-amber-100 text-amber-600") :
                        tx.type === 'fee' ? (isPremiumUI ? "bg-purple-500/10 text-purple-500" : "bg-purple-100 text-purple-600") :
                        tx.type === 'buy' ? (isPremiumUI ? "bg-blue-500/10 text-blue-500" : "bg-blue-100 text-blue-600") :
                        tx.type === 'sell' ? (isPremiumUI ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-100 text-emerald-600") :
                        tx.senderId === profile.id 
                          ? (isPremiumUI ? "bg-red-500/10 text-red-500" : "bg-red-100 text-red-600") 
                          : (isPremiumUI ? "bg-green-500/10 text-green-500" : "bg-green-100 text-green-600")
                      )}>
                        {tx.type === 'buy' || tx.type === 'sell' ? <TrendingUp className="w-6 h-6" /> :
                         tx.type === 'tax' || tx.type === 'fee' ? <ShieldCheck className="w-6 h-6" /> :
                         <ArrowRightLeft className={cn("w-6 h-6", tx.senderId === profile.id && "rotate-180")} />}
                      </div>
                      <div>
                        <p className={cn("font-bold", isPremiumUI ? "text-white" : "text-gray-900")}>
                          {tx.type === 'tax' ? 'Government Tax' :
                           tx.type === 'fee' ? 'Service Fee' :
                           tx.type === 'buy' ? `Bought ${tx.assetName}` :
                           tx.type === 'sell' ? `Sold ${tx.assetName}` :
                           tx.senderId === profile.id ? 'Outgoing Transfer' : 'Incoming Funds'}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                          {tx.type === 'buy' || tx.type === 'sell' ? `${tx.assetId}` :
                           tx.senderId === profile.id ? `To: ${tx.receiverId === 'SYSTEM' ? 'PayBank' : tx.receiverId === 'GOVT_TAX' ? 'Govt' : tx.receiverId}` : 
                           `From: ${tx.senderId === 'SYSTEM' ? 'PayBank' : tx.senderId}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-bold text-xl",
                        (tx.senderId === profile.id || tx.type === 'buy' || tx.type === 'tax' || tx.type === 'fee') ? "text-red-500" : "text-green-500"
                      )}>
                        {(tx.senderId === profile.id || tx.type === 'buy' || tx.type === 'tax' || tx.type === 'fee') ? '-' : '+'}₹{tx.amount}
                      </p>
                      <p className="text-[10px] text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Premium Portfolio Insights */}
          {isPremiumUI && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                "rounded-[2.5rem] p-8 shadow-sm lg:col-span-3",
                isPremiumUI 
                  ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                  : "bg-white border border-gray-100"
              )}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold">Portfolio Performance</h3>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", THEME_BLURS[theme].replace('bg-', 'bg-').replace('/5', ''))}></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Net Worth (7D)</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorthData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME_CHART_COLORS[theme]} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={THEME_CHART_COLORS[theme]} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      stroke="#4b5563" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      hide 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: THEME_CHART_COLORS[theme] }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={THEME_CHART_COLORS[theme]} 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

const TransferPage = () => {
  const { profile } = useFirebase();
  const [upi, setUpi] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState(1); // 1: Details, 2: PIN & Note
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!upi || isNaN(amt) || amt <= 0) return;
    if (amt > (profile?.balance || 0)) {
      setError('Insufficient balance');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!pin || pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await bankService.transfer(upi, amt, pin, note);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <LoadingScreen />;

  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "rounded-[2.5rem] shadow-xl p-8 transition-all",
            isPremiumUI 
              ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
              : "bg-white border border-gray-100"
          )}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isPremiumUI ? "bg-blue-500/10 text-blue-400" : "bg-blue-100 text-blue-600"
            )}>
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold">{step === 1 ? 'Send Money' : 'Confirm Payment'}</h2>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                isPremiumUI ? "bg-green-500/10 text-green-400" : "bg-green-100 text-green-600"
              )}>
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Transfer Successful!</h3>
              <p className="text-gray-500">Redirecting to dashboard...</p>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Recipient UPI ID</label>
                <input 
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="username@paybank"
                  className={cn(
                    "w-full p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-colors",
                    isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                  )}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Amount (₹)</label>
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none text-3xl font-bold transition-colors",
                    isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                  )}
                  required
                />
                <p className="mt-2 text-xs text-gray-500">Available Balance: ₹{profile.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              {error && (
                <div className={cn(
                  "p-4 border rounded-xl flex items-center gap-2 text-sm",
                  isPremiumUI ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-600"
                )}>
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg",
                  isPremiumUI 
                    ? "bg-white text-black hover:bg-gray-200" 
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                )}
              >
                Next
              </button>
            </form>
          ) : (
            <form onSubmit={handleTransfer} className="space-y-6">
              <div className={cn(
                "p-6 rounded-3xl mb-6",
                isPremiumUI ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"
              )}>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Paying To</p>
                <p className="text-xl font-bold mb-4">{upi}</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Amount</p>
                <p className="text-3xl font-black">₹{amount}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Enter 4-Digit PIN</label>
                <input 
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className={cn(
                    "w-full p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none text-center text-2xl tracking-[1em] font-bold transition-colors",
                    isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                  )}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Add a Note (Optional)</label>
                <input 
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What's this for?"
                  className={cn(
                    "w-full p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-colors",
                    isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                  )}
                />
              </div>

              {error && (
                <div className={cn(
                  "p-4 border rounded-xl flex items-center gap-2 text-sm",
                  isPremiumUI ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-600"
                )}>
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    "py-4 rounded-2xl font-bold transition-all",
                    isPremiumUI ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  Back
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "py-4 rounded-2xl font-bold transition-all shadow-lg disabled:opacity-50",
                    isPremiumUI 
                      ? "bg-white text-black hover:bg-gray-200" 
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                  )}
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

const DepositPage = () => {
  const { profile } = useFirebase();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setIsPinModalOpen(true);
  };

  const confirmDeposit = async (pin: string) => {
    setIsPinModalOpen(false);
    setLoading(true);
    setError('');
    try {
      await bankService.deposit(parseFloat(amount), pin);
      navigate('/dashboard');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <LoadingScreen />;

  const fee = profile.depositCount >= 5 ? 29 : 0;
  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "rounded-[2.5rem] shadow-xl p-8 transition-all",
            isPremiumUI 
              ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
              : "bg-white border border-gray-100"
          )}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isPremiumUI ? "bg-green-500/10 text-green-400" : "bg-green-100 text-green-600"
            )}>
              <PlusCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold">Add Money</h2>
          </div>

          <form onSubmit={handleDeposit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">Amount to Deposit (₹)</label>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full p-4 rounded-2xl focus:ring-2 focus:ring-green-600 outline-none text-3xl font-bold transition-colors",
                  isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                )}
                required
              />
              <div className={cn(
                "mt-4 p-4 rounded-2xl space-y-2",
                isPremiumUI ? "bg-white/5" : "bg-gray-50"
              )}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Deposit Count (this hour)</span>
                  <span className="font-bold">{profile.depositCount}/5</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Processing Fee</span>
                  <span className={cn("font-bold", fee > 0 ? "text-red-500" : "text-green-500")}>
                    {fee > 0 ? `₹${fee}` : 'FREE'}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className={cn(
                "p-4 border rounded-xl flex items-center gap-2 text-sm",
                isPremiumUI ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-600"
              )}>
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:opacity-50",
                isPremiumUI 
                  ? "bg-white text-black hover:bg-gray-200" 
                  : "bg-green-600 text-white hover:bg-green-700 shadow-green-100"
              )}
            >
              {loading ? 'Processing...' : 'Deposit Now'}
            </button>
          </form>

          <PinModal 
            isOpen={isPinModalOpen}
            onClose={() => setIsPinModalOpen(false)}
            onConfirm={confirmDeposit}
            title="Confirm Deposit"
            description={`Enter your PIN to deposit ₹${amount} into your account.`}
          />
        </motion.div>
      </div>
    </div>
  );
};

const PremiumPage = () => {
  const { profile } = useFirebase();
  const [customUpi, setCustomUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'upi' | 'ui', data?: any } | null>(null);

  const handleUpiSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUpi) return;
    setPendingAction({ type: 'upi', data: customUpi });
    setIsPinModalOpen(true);
  };

  const handleUiSub = () => {
    setPendingAction({ type: 'ui' });
    setIsPinModalOpen(true);
  };

  const confirmSubscription = async (pin: string) => {
    if (!pendingAction) return;
    setIsPinModalOpen(false);
    setLoading(true);
    setError('');
    try {
      if (pendingAction.type === 'upi') {
        await bankService.updateUpi(pendingAction.data, pin);
        setCustomUpi('');
      } else {
        await bankService.subscribeUi(pin);
      }
      setPendingAction(null);
    } catch (err: any) {
      setError(parseFirestoreError(err) || 'Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <LoadingScreen />;

  const isUpiPremium = profile.upiSubscriptionEnd > Date.now();
  const isUiPremium = profile.uiSubscriptionEnd > Date.now();
  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();
  const theme = profile.premiumTheme || 'midnight';

  const themes = [
    { id: 'midnight', name: 'Midnight', color: 'bg-blue-600', accent: 'text-blue-400' },
    { id: 'emerald', name: 'Emerald', color: 'bg-emerald-600', accent: 'text-emerald-400' },
    { id: 'ruby', name: 'Ruby', color: 'bg-red-600', accent: 'text-red-400' },
    { id: 'gold', name: 'Gold', color: 'bg-amber-600', accent: 'text-amber-400' },
    { id: 'neon', name: 'Neon', color: 'bg-purple-600', accent: 'text-fuchsia-400' },
    { id: 'sunset', name: 'Sunset', color: 'bg-orange-600', accent: 'text-orange-400' },
    { id: 'ocean', name: 'Ocean', color: 'bg-cyan-600', accent: 'text-cyan-400' },
    { id: 'cyber', name: 'Cyber', color: 'bg-lime-600', accent: 'text-lime-400' },
  ];

  const handleThemeSelect = async (themeId: any) => {
    if (!isUiPremium) return;
    setLoading(true);
    try {
      await bankService.setPremiumTheme(themeId);
    } catch (err: any) {
      setError(parseFirestoreError(err) || 'Failed to update theme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Upgrade Your Experience</h2>
          <p className={isPremiumUI ? "text-gray-400" : "text-gray-600"}>Unlock premium features and customize your simulated bank.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* UPI Premium */}
          <motion.div 
            whileHover={{ y: -5 }}
            className={cn(
              "rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden transition-all",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}
          >
            <div className="relative z-10">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                isPremiumUI ? "bg-purple-500/10 text-purple-400" : "bg-purple-100 text-purple-600"
              )}>
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Premium UPI</h3>
              <p className={isPremiumUI ? "text-gray-400 mb-6" : "text-gray-500 mb-6"}>Get a custom UPI ID that reflects your personality.</p>
              <div className="text-3xl font-bold mb-8">₹50 <span className="text-sm font-normal text-gray-400">/ 5 min</span></div>
              
              {isUpiPremium ? (
                <div className="space-y-4">
                  <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-2 font-bold",
                    isPremiumUI ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-600"
                  )}>
                    <CheckCircle2 className="w-5 h-5" />
                    Active until {new Date(profile.upiSubscriptionEnd).toLocaleTimeString()}
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await bankService.cancelUpiSubscription();
                        setSuccess('Premium UPI cancelled successfully.');
                      } catch (err: any) {
                        setError(parseFirestoreError(err) || 'Cancellation failed');
                      }
                    }}
                    className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold hover:bg-red-500/20 transition-all"
                  >
                    Cancel Subscription
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpiSub} className="space-y-4">
                  <input 
                    type="text"
                    value={customUpi}
                    onChange={(e) => setCustomUpi(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="custom-id"
                    className={cn(
                      "w-full p-4 rounded-2xl focus:ring-2 focus:ring-purple-600 outline-none transition-colors",
                      isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                    )}
                    required
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50"
                  >
                    Get Custom UPI
                  </button>
                </form>
              )}
            </div>
          </motion.div>

          {/* UI Premium */}
          <motion.div 
            whileHover={{ y: -5 }}
            className={cn(
              "rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden transition-all",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}
          >
            <div className="relative z-10">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                isPremiumUI ? "bg-amber-500/10 text-amber-400" : "bg-amber-100 text-amber-600"
              )}>
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Premium UI</h3>
              <p className={isPremiumUI ? "text-gray-400 mb-6" : "text-gray-500 mb-6"}>Unlock advanced dashboard layouts and economy insights.</p>
              <div className="text-3xl font-bold mb-8">₹99 <span className="text-sm font-normal text-gray-400">/ 5 min</span></div>
              
              {isUiPremium ? (
                <div className="space-y-4">
                  <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-2 font-bold",
                    isPremiumUI ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-600"
                  )}>
                    <CheckCircle2 className="w-5 h-5" />
                    Active until {new Date(profile.uiSubscriptionEnd).toLocaleTimeString()}
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await bankService.cancelUiSubscription();
                        setSuccess('Premium UI cancelled successfully.');
                      } catch (err: any) {
                        setError(parseFirestoreError(err) || 'Cancellation failed');
                      }
                    }}
                    className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold hover:bg-red-500/20 transition-all"
                  >
                    Cancel Subscription
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleUiSub}
                  disabled={loading}
                  className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
                >
                  Unlock Premium UI
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Theme Studio */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "mt-12 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden transition-all",
            isPremiumUI 
              ? "bg-white/5 border border-white/10 backdrop-blur-3xl" 
              : "bg-white border border-gray-100"
          )}
        >
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div>
                <h3 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <Palette className={cn("w-8 h-8", isPremiumUI ? THEME_ACCENTS[theme] : "text-blue-500")} />
                  Theme Studio
                </h3>
                <p className={isPremiumUI ? "text-gray-400" : "text-gray-500"}>
                  Personalize your entire banking interface with high-end visual themes.
                </p>
              </div>
              {!isUiPremium && (
                <div className="px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                  <Lock className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-bold text-amber-500">Requires Premium UI</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  disabled={!isUiPremium || loading}
                  className={cn(
                    "group relative p-6 rounded-[2.5rem] border-2 transition-all duration-500 text-left overflow-hidden",
                    !isUiPremium ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95",
                    (profile.premiumTheme === theme.id || (!profile.premiumTheme && theme.id === 'midnight'))
                      ? cn("border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20") 
                      : isPremiumUI ? "border-white/5 bg-white/5 hover:border-white/20" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  )}
                >
                  <div className={cn("w-14 h-14 rounded-2xl mb-4 shadow-xl transition-transform duration-500 group-hover:rotate-12", theme.color)}></div>
                  <p className="font-black text-xl mb-1 tracking-tight">{theme.name}</p>
                  <p className={cn("text-[10px] uppercase tracking-[0.2em] font-black opacity-60", theme.accent)}>Elite Theme</p>
                  
                  {(profile.premiumTheme === theme.id || (!profile.premiumTheme && theme.id === 'midnight')) && (
                    <div className="absolute top-6 right-6">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                  
                  {/* Hover Effect */}
                  <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500", theme.color)}></div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Decorative Background */}
          {isPremiumUI && (
            <div className={cn("absolute top-0 right-0 w-96 h-96 rounded-full -mr-48 -mt-48 blur-[100px] pointer-events-none opacity-20", THEME_BLURS[theme])}></div>
          )}
        </motion.div>

        {error && (
          <div className={cn(
            "mt-8 p-4 border rounded-xl flex items-center gap-2 text-sm max-w-md mx-auto",
            isPremiumUI ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-600"
          )}>
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && (
          <div className={cn(
            "mt-8 p-4 border rounded-xl flex items-center gap-2 text-sm max-w-md mx-auto",
            isPremiumUI ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-green-50 border-green-100 text-green-600"
          )}>
            <CheckCircle2 className="w-4 h-4" />
            {success}
          </div>
        )}

        <PinModal 
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onConfirm={confirmSubscription}
          title="Confirm Subscription"
          description={pendingAction?.type === 'upi' ? "Enter PIN to buy custom UPI ID for ₹50." : "Enter PIN to buy Premium UI for ₹99."}
        />
      </div>
    </div>
  );
};

const HistoryPage = () => {
  const { profile } = useFirebase();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'transactions'),
      or(
        where('senderId', '==', profile.id),
        where('receiverId', '==', profile.id)
      ),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions_history');
    });

    return () => unsubscribe();
  }, [profile]);

  if (loading) return <LoadingScreen />;

  const isPremiumUI = profile?.uiSubscriptionEnd && profile.uiSubscriptionEnd > Date.now();

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      (tx.note?.toLowerCase().includes(search.toLowerCase())) ||
      (tx.assetName?.toLowerCase().includes(search.toLowerCase())) ||
      (tx.senderId?.toLowerCase().includes(search.toLowerCase())) ||
      (tx.receiverId?.toLowerCase().includes(search.toLowerCase())) ||
      (tx.id?.toLowerCase().includes(search.toLowerCase()));
    
    const matchesType = filterType === 'all' || tx.type === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <h2 className="text-4xl font-bold tracking-tighter">Transaction History</h2>
          <div className="flex items-center gap-4">
            <div className={cn(
              "px-6 py-2 rounded-2xl text-sm font-bold",
              isPremiumUI ? "bg-white/5 text-white border border-white/10" : "bg-blue-100 text-blue-600"
            )}>
              {filteredTransactions.length} Total
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="relative">
            <input 
              type="text"
              placeholder="Search by note, ID, or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full p-4 pl-12 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-all",
                isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-white border border-gray-200"
              )}
            />
            <AlertCircle className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={cn(
              "w-full p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-all",
              isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-white border border-gray-200"
            )}
          >
            <option value="all">All Types</option>
            <option value="transfer">Transfers</option>
            <option value="tax">Taxes</option>
            <option value="fee">Fees</option>
            <option value="buy">Purchases</option>
            <option value="sell">Sales</option>
            <option value="withdraw">Withdrawals</option>
          </select>
        </div>

        <div className={cn(
          "rounded-[2.5rem] shadow-xl overflow-hidden transition-all",
          isPremiumUI 
            ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
            : "bg-white border border-gray-100"
        )}>
          <div className={cn(
            "divide-y",
            isPremiumUI ? "divide-white/5" : "divide-gray-100"
          )}>
            {filteredTransactions.length === 0 ? (
              <div className="p-20 text-center text-gray-500">
                <History className="w-16 h-16 mx-auto mb-6 opacity-20" />
                <p className="text-lg">No transactions found matching your criteria.</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className={cn(
                    "p-8 flex items-center justify-between transition-colors",
                    isPremiumUI ? "hover:bg-white/5" : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center",
                      tx.type === 'tax' ? (isPremiumUI ? "bg-amber-500/10 text-amber-500" : "bg-amber-100 text-amber-600") :
                      tx.type === 'fee' ? (isPremiumUI ? "bg-purple-500/10 text-purple-500" : "bg-purple-100 text-purple-600") :
                      tx.type === 'buy' ? (isPremiumUI ? "bg-blue-500/10 text-blue-500" : "bg-blue-100 text-blue-600") :
                      tx.type === 'sell' ? (isPremiumUI ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-100 text-emerald-600") :
                      tx.senderId === profile?.id 
                        ? (isPremiumUI ? "bg-red-500/10 text-red-500" : "bg-red-100 text-red-600") 
                        : (isPremiumUI ? "bg-green-500/10 text-green-500" : "bg-green-100 text-green-600")
                    )}>
                      {tx.type === 'buy' || tx.type === 'sell' ? <TrendingUp className="w-7 h-7" /> :
                       tx.type === 'tax' || tx.type === 'fee' ? <ShieldCheck className="w-7 h-7" /> :
                       <ArrowRightLeft className={cn("w-7 h-7", tx.senderId === profile?.id && "rotate-180")} />}
                    </div>
                    <div>
                      <p className={cn("text-lg font-bold", isPremiumUI ? "text-white" : "text-gray-900")}>
                        {tx.type === 'tax' ? 'Government Tax' :
                         tx.type === 'fee' ? 'Service Fee' :
                         tx.type === 'buy' ? `Bought ${tx.assetName}` :
                         tx.type === 'sell' ? `Sold ${tx.assetName}` :
                         tx.senderId === profile?.id ? 'Outgoing Transfer' : 'Incoming Funds'}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {tx.type === 'buy' || tx.type === 'sell' ? `${tx.assetId} @ ₹${tx.assetPrice}` :
                         tx.senderId === profile?.id ? `To: ${tx.receiverId === 'SYSTEM' ? 'PayBank' : tx.receiverId === 'GOVT_TAX' ? 'Govt' : tx.receiverId}` : 
                         `From: ${tx.senderId === 'SYSTEM' ? 'PayBank' : tx.senderId}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(tx.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-2xl font-bold tracking-tight",
                      (tx.senderId === profile?.id || tx.type === 'buy' || tx.type === 'tax' || tx.type === 'fee') ? "text-red-500" : "text-green-500"
                    )}>
                      {(tx.senderId === profile?.id || tx.type === 'buy' || tx.type === 'tax' || tx.type === 'fee') ? '-' : '+'}₹{tx.amount}
                    </p>
                    <span className={cn(
                      "inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded mt-1",
                      isPremiumUI ? "bg-green-500/10 text-green-500" : "bg-green-50 text-green-600"
                    )}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemPage = () => {
  const { profile } = useFirebase();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await bankService.getSystemStats();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!stats) return <div className="p-20 text-center">Failed to load system stats.</div>;

  const isPremiumUI = profile?.uiSubscriptionEnd && profile.uiSubscriptionEnd > Date.now();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold tracking-tighter mb-2">System Overview</h2>
          <p className="text-gray-500">Global network statistics and health.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-xl",
            isPremiumUI ? "bg-white/5 border border-white/10" : "bg-white border border-gray-100"
          )}>
            <Users className="w-8 h-8 text-blue-500 mb-4" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-1">Total Users</p>
            <p className="text-3xl font-black">{stats.totalUsers}</p>
          </div>
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-xl",
            isPremiumUI ? "bg-white/5 border border-white/10" : "bg-white border border-gray-100"
          )}>
            <ArrowRightLeft className="w-8 h-8 text-purple-500 mb-4" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-1">Total Transactions</p>
            <p className="text-3xl font-black">{stats.totalTransactions}</p>
          </div>
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-xl",
            isPremiumUI ? "bg-white/5 border border-white/10" : "bg-white border border-gray-100"
          )}>
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-4" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-1">Total Volume</p>
            <p className="text-3xl font-black">₹{stats.totalVolume.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-xl",
            isPremiumUI ? "bg-white/5 border border-white/10" : "bg-white border border-gray-100"
          )}>
            <Landmark className="w-8 h-8 text-amber-500 mb-4" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-1">Bank Liquidity</p>
            <p className="text-3xl font-black">₹{stats.bankBalance.toLocaleString()}</p>
          </div>
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-xl",
            isPremiumUI ? "bg-white/5 border border-white/10" : "bg-white border border-gray-100"
          )}>
            <CreditCard className="w-8 h-8 text-indigo-500 mb-4" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-1">Active Loans</p>
            <p className="text-3xl font-black">{stats.activeLoans}</p>
            <p className="text-xs text-gray-500 mt-2">Total Disbursed: {stats.totalLoansDisbursed}</p>
          </div>
        </div>

        <div className="mt-12 p-6 text-center text-xs text-gray-500">
          Last updated: {new Date(stats.lastUpdated).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

const MarketPage = () => {
  const { profile } = useFirebase();
  const { marketData } = useEconomy();
  const [tradingAsset, setTradingAsset] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<{ type: 'buy' | 'sell', asset: any, qty: number } | null>(null);

  if (!profile) return <LoadingScreen />;

  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();
  const theme = profile.premiumTheme || 'midnight';

  const handleTrade = (type: 'buy' | 'sell') => {
    if (!tradingAsset) return;
    setPendingTrade({ type, asset: tradingAsset, qty: quantity });
    setIsPinModalOpen(true);
  };

  const confirmTrade = async (pin: string) => {
    if (!pendingTrade) return;
    setIsPinModalOpen(false);
    setLoading(true);
    setError('');
    try {
      if (pendingTrade.type === 'buy') {
        await bankService.buyAsset(pendingTrade.asset.id, pendingTrade.asset.name, pendingTrade.asset.price, pendingTrade.qty, pin);
      } else {
        await bankService.sellAsset(pendingTrade.asset.id, pendingTrade.asset.name, pendingTrade.asset.price, pendingTrade.qty, pin);
      }
      setTradingAsset(null);
      setQuantity(1);
      setPendingTrade(null);
    } catch (err: any) {
      setError(parseFirestoreError(err) || 'Trade failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Simulated Global Market</h2>
            <p className={isPremiumUI ? "text-gray-400" : "text-gray-500"}>
              Track real-time fluctuations and trade in the PayBank simulated economy.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isPremiumUI && (
              <div className={cn(
                "p-6 rounded-[2rem] border transition-all flex items-center gap-4",
                isPremiumUI ? cn("bg-white/5", THEME_BORDERS[theme]) : "bg-white border-gray-100 shadow-sm"
              )}>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Market Volatility</p>
                  <p className={cn("text-2xl font-bold tracking-tighter", THEME_ACCENTS[theme])}>High (82%)</p>
                </div>
                <TrendingUp className={cn("w-8 h-8", THEME_ACCENTS[theme])} />
              </div>
            )}
            <div className={cn(
              "p-6 rounded-[2rem] border transition-all",
              isPremiumUI ? cn("bg-white/5", THEME_BORDERS[theme]) : "bg-white border-gray-100 shadow-sm"
            )}>
              <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Your Portfolio Balance</p>
              <p className="text-2xl font-bold tracking-tighter">₹{profile.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {isPremiumUI && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className={cn(
              "lg:col-span-2 rounded-[2.5rem] p-8 shadow-sm transition-all",
              "bg-white/5 border backdrop-blur-xl",
              THEME_BORDERS[theme]
            )}>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold">Market Sentiment Index</h3>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", THEME_ACCENTS[theme].replace('text-', 'bg-'))}></div>
                  <span className={cn("text-xs font-bold uppercase tracking-widest", THEME_ACCENTS[theme])}>Bullish (74%)</span>
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { name: '10:00', value: 40 },
                    { name: '11:00', value: 45 },
                    { name: '12:00', value: 42 },
                    { name: '13:00', value: 55 },
                    { name: '14:00', value: 68 },
                    { name: '15:00', value: 74 },
                  ]}>
                    <defs>
                      <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME_CHART_COLORS[theme]} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={THEME_CHART_COLORS[theme]} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '12px' }}
                      itemStyle={{ color: THEME_CHART_COLORS[theme] }}
                    />
                    <Area type="monotone" dataKey="value" stroke={THEME_CHART_COLORS[theme]} strokeWidth={3} fill="url(#colorSentiment)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className={cn(
              "rounded-[2.5rem] p-8 shadow-sm transition-all",
              "bg-white/5 border backdrop-blur-xl flex flex-col justify-between",
              THEME_BORDERS[theme]
            )}>
              <div>
                <h3 className="text-lg font-bold mb-2">Elite Insights</h3>
                <p className="text-sm text-gray-400">Our AI predicts a significant surge in F-Coin over the next 24 hours due to increased simulated liquidity.</p>
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Risk Level</span>
                  <span className={cn("text-sm font-bold", THEME_ACCENTS[theme])}>Elite Risk</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Opportunity</span>
                  <span className={cn("text-sm font-bold", THEME_ACCENTS[theme])}>High</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {marketData.map((asset) => (
            <motion.div 
              key={asset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-[2.5rem] p-8 shadow-sm transition-all hover:scale-[1.02]",
                isPremiumUI 
                  ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                  : "bg-white border border-gray-100"
              )}
            >
              <div className="flex justify-between items-start mb-8">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  isPremiumUI ? "bg-white/5" : "bg-blue-50 text-blue-600"
                )}>
                  {asset.id === 'fcoin' ? <AlertCircle className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  asset.change >= 0 
                    ? "bg-green-500/10 text-green-500" 
                    : "bg-red-500/10 text-red-500"
                )}>
                  {asset.change >= 0 ? '+' : ''}{asset.change}%
                </div>
              </div>

              <h3 className="text-xl font-bold mb-1">{asset.name}</h3>
              <p className="text-gray-500 text-sm mb-6 uppercase tracking-widest font-bold">{asset.id}</p>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tracking-tighter">₹{asset.price.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Current Price</p>
                </div>
                <button 
                  onClick={() => setTradingAsset(asset)}
                  className={cn(
                    "px-6 py-2 rounded-xl font-bold text-sm transition-all",
                    isPremiumUI 
                      ? "bg-white text-black hover:bg-gray-200" 
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  Trade
                </button>
              </div>
              
              {profile.holdings?.[asset.id] && (
                <div className="mt-6 pt-6 border-t border-dashed border-gray-500/20">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Your Holdings</p>
                  <p className="font-bold">{profile.holdings[asset.id]} Units</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {tradingAsset && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={cn(
                  "max-w-md w-full rounded-[2.5rem] p-8 shadow-2xl",
                  isPremiumUI ? "bg-[#111] border border-white/10 text-white" : "bg-white text-gray-900"
                )}
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">Trade {tradingAsset.name}</h3>
                    <p className="text-gray-500 text-sm uppercase tracking-widest font-bold">{tradingAsset.id}</p>
                  </div>
                  <button 
                    onClick={() => setTradingAsset(null)}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <PlusCircle className="w-6 h-6 rotate-45 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className={cn("p-6 rounded-2xl", isPremiumUI ? "bg-white/5" : "bg-gray-50")}>
                    <div className="flex justify-between mb-4">
                      <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Price per unit</span>
                      <span className="font-bold">₹{tradingAsset.price}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Quantity</span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                          -
                        </button>
                        <span className="text-xl font-bold min-w-[20px] text-center">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end px-2">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Total Value</p>
                      <p className="text-3xl font-bold tracking-tighter">₹{(tradingAsset.price * quantity).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Available</p>
                      <p className="font-bold">₹{profile.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleTrade('buy')}
                      disabled={loading}
                      className="py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                    >
                      {loading ? '...' : 'Buy Asset'}
                    </button>
                    <button 
                      onClick={() => handleTrade('sell')}
                      disabled={loading || (profile.holdings?.[tradingAsset.id] || 0) < quantity}
                      className="py-4 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                    >
                      {loading ? '...' : 'Sell Asset'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <PinModal 
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onConfirm={confirmTrade}
          title={pendingTrade?.type === 'buy' ? "Confirm Purchase" : "Confirm Sale"}
          description={`Enter PIN to ${pendingTrade?.type} ${pendingTrade?.qty} units of ${pendingTrade?.asset?.name}.`}
        />

        <div className={cn(
          "mt-12 p-8 rounded-[2.5rem] border border-dashed",
          isPremiumUI ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex items-center gap-4 text-amber-500 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h4 className="font-bold">Market Warning</h4>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Market trading is highly volatile. PayBank does not guarantee any returns on simulated investments. 
            All trading is done with simulated currency and has no real-world value.
          </p>
        </div>
      </div>
    </div>
  );
};

const WithdrawPage = () => {
  const { profile } = useFirebase();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setIsPinModalOpen(true);
  };

  const confirmWithdraw = async (pin: string) => {
    setIsPinModalOpen(false);
    setLoading(true);
    setError('');
    try {
      await bankService.withdraw(parseFloat(amount), pin);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: any) {
      setError(parseFirestoreError(err) || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return <LoadingScreen />;

  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();
  const withdrawCount = profile.withdrawCount || 0;
  const isFree = withdrawCount < 3;

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "rounded-[2.5rem] shadow-xl p-8 transition-all",
            isPremiumUI 
              ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
              : "bg-white border border-gray-100"
          )}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isPremiumUI ? "bg-red-500/10 text-red-400" : "bg-red-100 text-red-600"
            )}>
              <LogOut className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold">Withdraw Money</h2>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                isPremiumUI ? "bg-green-500/10 text-green-400" : "bg-green-100 text-green-600"
              )}>
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Withdrawal Successful!</h3>
              <p className="text-gray-500">Redirecting to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="space-y-6">
              <div className={cn(
                "p-4 rounded-2xl mb-4",
                isPremiumUI ? "bg-white/5 border border-white/10" : "bg-blue-50 border border-blue-100"
              )}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Free Withdrawals</span>
                  <span className={cn("text-sm font-bold", isFree ? "text-green-500" : "text-red-500")}>
                    {3 - withdrawCount > 0 ? 3 - withdrawCount : 0} Left
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  {isFree ? "You have free withdrawals remaining." : "Free limit exceeded. ₹19 fee applies per transaction."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Amount (₹)</label>
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none text-3xl font-bold transition-colors",
                    isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                  )}
                  required
                />
                <p className="mt-2 text-xs text-gray-500">Available Balance: ₹{profile.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              {error && (
                <div className={cn(
                  "p-4 border rounded-xl flex items-center gap-2 text-sm",
                  isPremiumUI ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-600"
                )}>
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:opacity-50",
                  isPremiumUI 
                    ? "bg-white text-black hover:bg-gray-200" 
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                )}
              >
                {loading ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </form>
          )}

          <PinModal 
            isOpen={isPinModalOpen}
            onClose={() => setIsPinModalOpen(false)}
            onConfirm={confirmWithdraw}
            title="Confirm Withdrawal"
            description={`Enter your PIN to withdraw ₹${amount} from your account.`}
          />
        </motion.div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { profile } = useFirebase();
  const [aadhaar, setAadhaar] = useState<AadhaarRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinLoading, setPinLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingPause, setPendingPause] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    const fetchAadhaar = async () => {
      try {
        const record = await bankService.getAadhaar(profile.aadhaarId);
        setAadhaar(record);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAadhaar();
  }, [profile]);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    setPinLoading(true);
    setError('');
    setSuccess('');
    try {
      await bankService.setPin(pin);
      setSuccess('PIN set successfully!');
      setPin('');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setPinLoading(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin.length !== 4 || newPin.length !== 4) return;
    setPinLoading(true);
    setError('');
    setSuccess('');
    try {
      await bankService.changePin(oldPin, newPin);
      setSuccess('PIN changed successfully!');
      setOldPin('');
      setNewPin('');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setPinLoading(false);
    }
  };

  const handlePauseGame = (duration: number) => {
    setPendingPause(duration);
    setIsPinModalOpen(true);
  };

  const confirmPauseGame = async (pin: string) => {
    if (pendingPause === null) return;
    setIsPinModalOpen(false);
    setPauseLoading(true);
    setError('');
    setSuccess('');
    try {
      await bankService.pauseGame(pendingPause, pin);
      setSuccess(pendingPause === -1 ? 'Game paused indefinitely.' : `Game paused for ${pendingPause} minutes.`);
      setPendingPause(null);
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setPauseLoading(false);
    }
  };

  const handleResumeGame = async () => {
    setPauseLoading(true);
    setError('');
    setSuccess('');
    try {
      await bankService.resumeGame();
      setSuccess('Game resumed.');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setPauseLoading(false);
    }
  };

  if (!profile || loading) return <LoadingScreen />;

  const isPremiumUI = profile.uiSubscriptionEnd > Date.now();
  const theme = profile.premiumTheme || 'midnight';

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isPremiumUI ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-4">Account Settings</h2>
          <p className={isPremiumUI ? "text-gray-400" : "text-gray-600"}>Manage your profile and security details.</p>
        </div>

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className={cn(
              "rounded-[2.5rem] shadow-xl p-8 transition-all",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <UserIcon className={cn("w-5 h-5", isPremiumUI ? THEME_ACCENTS[theme] : "text-blue-600")} />
                Personal Information
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Full Name</p>
                    <p className="font-bold text-lg">{profile.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Email Address</p>
                    <p className="font-bold text-lg">{profile.email}</p>
                  </div>
                </div>
                <div className={cn(
                  "pt-6 border-t",
                  isPremiumUI ? "border-white/5" : "border-gray-100"
                )}>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Verified Aadhaar Number</p>
                  <div className="flex items-center gap-3">
                    <p className="text-3xl font-mono font-bold tracking-[0.2em]">
                      {aadhaar?.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim() || '•••• •••• ••••'}
                    </p>
                    <ShieldCheck className="text-green-500 w-8 h-8" />
                  </div>
                </div>
              </div>
            </div>

            {/* PIN Management */}
            <div className={cn(
              "rounded-[2.5rem] shadow-xl p-8 transition-all",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Lock className={cn("w-5 h-5", isPremiumUI ? THEME_ACCENTS[theme] : "text-blue-600")} />
                Security PIN
              </h3>
              
              {!profile.pin ? (
                <form onSubmit={handleSetPin} className="space-y-4">
                  <p className="text-sm text-gray-500 mb-4">Create a 4-digit PIN to secure your transactions.</p>
                  <div className="flex gap-4">
                    <input 
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 4-digit PIN"
                      className={cn(
                        "flex-1 p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-colors",
                        isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                      )}
                      required
                    />
                    <button 
                      type="submit"
                      disabled={pinLoading || pin.length !== 4}
                      className={cn(
                        "px-8 rounded-2xl font-bold transition-all disabled:opacity-50",
                        isPremiumUI ? "bg-white text-black hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
                      )}
                    >
                      {pinLoading ? '...' : 'Set PIN'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleChangePin} className="space-y-4">
                  <p className="text-sm text-gray-500 mb-4">Change your existing transaction PIN.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input 
                      type="password"
                      maxLength={4}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Current PIN"
                      className={cn(
                        "p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-colors",
                        isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                      )}
                      required
                    />
                    <input 
                      type="password"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="New PIN"
                      className={cn(
                        "p-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-colors",
                        isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                      )}
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={pinLoading || oldPin.length !== 4 || newPin.length !== 4}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold transition-all disabled:opacity-50",
                      isPremiumUI ? "bg-white text-black hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                  >
                    {pinLoading ? 'Processing...' : 'Update PIN'}
                  </button>
                </form>
              )}
            </div>

            <div className={cn(
              "rounded-[2.5rem] shadow-xl p-8 transition-all",
              isPremiumUI 
                ? "bg-white/5 border border-white/10 backdrop-blur-xl" 
                : "bg-white border border-gray-100"
            )}>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Wallet className={cn("w-5 h-5", isPremiumUI ? THEME_ACCENTS[theme] : "text-blue-600")} />
                Banking Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className={cn("p-4 rounded-2xl", isPremiumUI ? "bg-white/5" : "bg-gray-50")}>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Account Number</p>
                  <p className="font-mono font-bold text-lg">{profile.accountNumber}</p>
                </div>
                <div className={cn("p-4 rounded-2xl", isPremiumUI ? "bg-white/5" : "bg-gray-50")}>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">UPI ID</p>
                  <p className="font-bold text-lg">{profile.upiId}</p>
                </div>
                <div className={cn("p-4 rounded-2xl", isPremiumUI ? "bg-white/5" : "bg-gray-50")}>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Member Since</p>
                  <p className="font-bold text-lg">{new Date(profile.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Game Pause Feature */}
            <div className={cn(
              "rounded-[2.5rem] p-8 shadow-xl",
              isPremiumUI ? "bg-white/5 border border-white/10 backdrop-blur-xl" : "bg-white border border-gray-100"
            )}>
              <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className={cn("w-5 h-5", isPremiumUI ? THEME_ACCENTS[theme] : "text-blue-600")} />
                Pause Game
              </h4>
              <p className="text-xs text-gray-500 mb-6">Temporarily stop billing and market updates.</p>
              
              {profile.isGamePaused && (profile.gamePauseEndTime > Date.now() || profile.gamePauseEndTime === -1) ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Game Status</p>
                    <p className="text-lg font-bold text-amber-500">
                      {profile.gamePauseEndTime === -1 ? 'Paused Indefinitely' : `Paused Until ${new Date(profile.gamePauseEndTime).toLocaleTimeString()}`}
                    </p>
                  </div>
                  <button 
                    onClick={handleResumeGame}
                    disabled={pauseLoading}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    Resume Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {[15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handlePauseGame(mins)}
                      disabled={pauseLoading}
                      className={cn(
                        "py-3 rounded-xl font-bold transition-all text-sm",
                        isPremiumUI ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"
                      )}
                    >
                      Pause for {mins}m
                    </button>
                  ))}
                  <button
                    onClick={() => handlePauseGame(-1)}
                    disabled={pauseLoading}
                    className={cn(
                      "py-3 rounded-xl font-bold transition-all text-sm",
                      isPremiumUI ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                    )}
                  >
                    Until Switched On
                  </button>
                </div>
              )}
            </div>

            <div className={cn(
              "rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden",
              isPremiumUI ? "bg-blue-900/40 border border-blue-500/20" : "bg-blue-600 text-white"
            )}>
              <Crown className="w-10 h-10 mb-6 text-amber-400" />
              <h4 className="text-2xl font-bold mb-2">Premium Status</h4>
              <div className="space-y-6 mt-8">
                <div className="flex justify-between items-center text-sm">
                  <span className={isPremiumUI ? "text-gray-400" : "text-blue-100"}>Custom UPI</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest",
                    profile.upiCustom 
                      ? (isPremiumUI ? "bg-amber-500/10 text-amber-400" : "bg-white text-blue-600") 
                      : (isPremiumUI ? "bg-white/5 text-gray-500" : "bg-blue-700 text-blue-200")
                  )}>
                    {profile.upiCustom ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className={isPremiumUI ? "text-gray-400" : "text-blue-100"}>Premium UI</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest",
                    profile.uiSubscriptionEnd > Date.now()
                      ? (isPremiumUI ? "bg-amber-500/10 text-amber-400" : "bg-white text-blue-600") 
                      : (isPremiumUI ? "bg-white/5 text-gray-500" : "bg-blue-700 text-blue-200")
                  )}>
                    {profile.uiSubscriptionEnd > Date.now() ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <Link to="/premium" className={cn(
                "block w-full text-center mt-10 py-4 rounded-2xl font-bold transition-all",
                isPremiumUI 
                  ? "bg-white text-black hover:bg-gray-200" 
                  : "bg-white text-blue-600 hover:bg-blue-50"
              )}>
                Manage Plans
              </Link>
            </div>
          </div>
        </div>

        <PinModal 
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onConfirm={confirmPauseGame}
          title="Confirm Pause"
          description="Enter PIN to pause the game economy."
        />
      </div>
    </div>
  );
};

const GamePauseOverlay = ({ groupId, userId }: { groupId: string, userId: string }) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'groups', groupId), (snapshot) => {
      if (snapshot.exists()) {
        setGroup(snapshot.data() as Group);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${groupId}`);
    });
    return () => unsub();
  }, [groupId]);

  if (!group || !group.isPaused || (group.resumedBy || []).includes(userId)) return null;

  const handleResume = async () => {
    if (!pin) return;
    setLoading(true);
    setError(null);
    try {
      await bankService.resumeGroupGame(pin);
      setPin('');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6"
      >
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Pause className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Game Paused</h2>
          <p className="text-gray-500 mt-2">A member is performing a sensitive transaction. All members must enter their PIN to resume the game.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input 
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 4-Digit PIN"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center text-2xl tracking-[1em] font-bold outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button 
            onClick={handleResume}
            disabled={loading || pin.length !== 4}
            className="w-full py-4 bg-amber-600 text-white rounded-2xl font-bold text-lg hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-100"
          >
            {loading ? 'Verifying...' : 'Resume Game'}
          </button>
        </div>

        <p className="text-xs text-gray-400">
          Resumed by: {group.resumedBy?.length || 0} / {group.members.length} members
        </p>
      </motion.div>
    </motion.div>
  );
};

// --- Main App Component ---

const AppContent = () => {
  const { user, profile, loading, isAuthReady } = useFirebase();

  if (!isAuthReady || (user && loading)) {
    return <LoadingScreen />;
  }

  if (profile?.isBanned) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">ACCOUNT BANNED</h1>
          <p className="text-red-400 max-w-md mx-auto">
            Your account has been suspended due to unpaid loans. Please contact support or have a friend/group member repay your outstanding balance.
          </p>
        </div>
      </div>
    );
  }

  const isPremiumUI = profile?.uiSubscriptionEnd && profile.uiSubscriptionEnd > Date.now();

  return (
    <div className={cn(
      "min-h-screen font-sans transition-colors duration-500",
      isPremiumUI ? "bg-[#050505]" : "bg-gray-50"
    )}>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route 
            path="/onboarding" 
            element={user ? <OnboardingPage /> : <Navigate to="/" />} 
          />
          <Route 
            path="/dashboard" 
            element={user ? (profile ? <Dashboard /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/transfer" 
            element={user ? (profile ? <TransferPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/withdraw" 
            element={user ? (profile ? <WithdrawPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/deposit" 
            element={user ? (profile ? <DepositPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/friends" 
            element={user ? (profile ? <FriendsTab user={profile} /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/loans" 
            element={user ? (profile ? <LoanSection user={profile} /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/premium" 
            element={user ? (profile ? <PremiumPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/transactions" 
            element={user ? (profile ? <HistoryPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/system" 
            element={user ? (profile ? <SystemPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/market" 
            element={user ? (profile ? <MarketPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route 
            path="/settings" 
            element={user ? (profile ? <SettingsPage /> : <Navigate to="/onboarding" />) : <Navigate to="/" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      
      {/* Global Pause Overlay */}
      {profile?.groupId && <GamePauseOverlay groupId={profile.groupId} userId={profile.id} />}

      {/* Footer Disclaimer */}
      <footer className="py-8 text-center text-gray-400 text-xs">
        <p>© 2026 PayBank Simulated Systems. No real money involved.</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <EconomyProvider>
          <Router>
            <AppContent />
          </Router>
        </EconomyProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
