import React, { useState, useEffect } from 'react';
import { bankService } from '../services/bankService';
import { Loan, UserProfile, OperationType } from '../types';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, parseFirestoreError } from '../lib/error-handler';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CreditCard, History, AlertTriangle, CheckCircle, Ban, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';

interface LoanSectionProps {
  user: UserProfile;
}

const RepaymentHistory = ({ loanId }: { loanId: string }) => {
  const [repayments, setRepayments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepayments = async () => {
      try {
        const data = await bankService.getLoanRepayments(loanId);
        setRepayments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRepayments();
  }, [loanId]);

  if (loading) return <div className="text-[10px] text-gray-400">Loading history...</div>;
  if (repayments.length === 0) return <div className="text-[10px] text-gray-400 italic">No repayments yet.</div>;

  return (
    <div className="space-y-1 mt-2 border-t pt-2 max-h-32 overflow-y-auto">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Repayment History</p>
      {repayments.map(tx => (
        <div key={tx.id} className="flex justify-between text-[10px]">
          <span className="text-gray-500">{new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span className="font-bold text-emerald-600">₹{tx.amount}</span>
        </div>
      ))}
    </div>
  );
};

export const LoanSection: React.FC<LoanSectionProps> = ({ user }) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showApplyBank, setShowApplyBank] = useState(false);
  const [showApplyFriend, setShowApplyFriend] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [bankLoan, setBankLoan] = useState({ principal: '', duration: '60', pin: '' });
  const [friendLoan, setFriendLoan] = useState({ upiId: '', principal: '', interest: '', duration: '', pin: '', lenderPin: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'loans'), where('borrowerId', '==', user.id));
    const unsub = onSnapshot(q, (snapshot) => {
      setLoans(snapshot.docs.map(doc => doc.data() as Loan));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'loans');
    });
    return () => unsub();
  }, [user.id]);

  // Periodic loan processing (simulated)
  useEffect(() => {
    const interval = setInterval(() => {
      bankService.processLoans();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleBankLoan = async () => {
    if (!bankLoan.principal || !bankLoan.duration || !bankLoan.pin) return;
    setLoading(true);
    try {
      await bankService.takeBankLoan(parseFloat(bankLoan.principal), parseInt(bankLoan.duration), bankLoan.pin);
      setShowApplyBank(false);
      setBankLoan({ principal: '', duration: '60', pin: '' });
      setSuccess('Bank loan approved and disbursed!');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFriendLoan = async () => {
    if (!friendLoan.upiId || !friendLoan.principal || !friendLoan.interest || !friendLoan.duration || !friendLoan.pin || !friendLoan.lenderPin) return;
    setLoading(true);
    try {
      await bankService.takeFriendLoan(
        friendLoan.upiId,
        parseFloat(friendLoan.principal),
        parseFloat(friendLoan.interest),
        parseInt(friendLoan.duration),
        friendLoan.pin,
        friendLoan.lenderPin
      );
      setShowApplyFriend(false);
      setFriendLoan({ upiId: '', principal: '', interest: '', duration: '', pin: '', lenderPin: '' });
      setSuccess('Friend loan approved and disbursed!');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (loanId: string) => {
    const pin = prompt('Lender must enter PIN to unban:');
    if (!pin) return;
    setLoading(true);
    try {
      await bankService.unbanFriendLoan(loanId, pin);
      setSuccess('Borrower unbanned!');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-800 font-bold">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-800 font-bold">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setShowApplyBank(true)}
          className="bg-indigo-600 text-white p-6 rounded-2xl flex flex-col items-center text-center space-y-2 hover:bg-indigo-700 transition-colors"
        >
          <CreditCard className="w-8 h-8" />
          <span className="font-bold">Apply Bank Loan</span>
          <span className="text-xs opacity-80">8% Interest • Max ₹1L • 1 Year (60 min)</span>
        </button>
        <button
          onClick={() => setShowApplyFriend(true)}
          className="bg-white border-2 border-indigo-600 text-indigo-600 p-6 rounded-2xl flex flex-col items-center text-center space-y-2 hover:bg-indigo-50 transition-colors"
        >
          <History className="w-8 h-8" />
          <span className="font-bold">Borrow from Friend</span>
          <span className="text-xs opacity-80">Custom Terms • Instant Approval • PIN Required</span>
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          Active Loans
        </h3>
        {loans.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-200 text-center text-gray-400">
            No active loans found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map(loan => (
              <div key={loan.id} className={`bg-white p-4 rounded-2xl border-2 ${loan.status === 'banned' || loan.status === 'defaulted' ? 'border-red-200 bg-red-50' : 'border-gray-100'} space-y-3`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm">{loan.lenderId === 'BANK' ? 'Bank Loan' : 'Friend Loan'}</p>
                    <p className="text-[10px] text-gray-500">ID: {loan.id}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    loan.status === 'active' ? 'bg-green-100 text-green-700' : 
                    loan.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {loan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Principal</p>
                    <p className="font-bold">₹{loan.principal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Interest</p>
                    <p className="font-bold">{loan.interestRate}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repaid</p>
                    <p className="font-bold">₹{loan.totalRepaid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Installment</p>
                    <p className="font-bold text-indigo-600">₹{loan.monthlyInstallment.toLocaleString()}</p>
                  </div>
                </div>

                {loan.status === 'active' && (
                  <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2 text-[10px]">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>Next payment: {new Date(loan.nextPaymentTime).toLocaleTimeString()}</span>
                  </div>
                )}

                <button 
                  onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                  className="w-full flex items-center justify-between text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors pt-2"
                >
                  {expandedLoan === loan.id ? 'Hide History' : 'Show Repayment History'}
                  {expandedLoan === loan.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {expandedLoan === loan.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <RepaymentHistory loanId={loan.id} />
                  </motion.div>
                )}

                {(loan.status === 'banned' || loan.status === 'defaulted') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                      <Ban className="w-4 h-4" />
                      Account Banned
                    </div>
                    <p className="text-[10px] text-red-500">Missed payments: {loan.missedPayments} • Fine: ₹{loan.fine}</p>
                    {loan.lenderId !== 'BANK' && loan.lenderId === auth.currentUser?.uid && (
                      <button
                        onClick={() => handleUnban(loan.id)}
                        className="w-full bg-red-600 text-white py-1 rounded-lg text-xs font-medium"
                      >
                        Unban Borrower
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showApplyBank && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-2xl w-full max-w-md"
            >
              <h3 className="text-xl font-bold mb-4">Apply Bank Loan</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount (₹)</label>
                  <input
                    type="number"
                    max={100000}
                    value={bankLoan.principal}
                    onChange={(e) => setBankLoan({ ...bankLoan, principal: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Max: ₹1,00,000</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    max={60}
                    value={bankLoan.duration}
                    onChange={(e) => setBankLoan({ ...bankLoan, duration: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Max: 60 min (1 Year)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={bankLoan.pin}
                    onChange={(e) => setBankLoan({ ...bankLoan, pin: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                    placeholder="Enter 4-digit PIN"
                  />
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-700">
                  <p>Interest Rate: 8% per annum</p>
                  <p>Repayment: Automatic every {parseInt(bankLoan.duration || '60') / 12} minutes</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleBankLoan}
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium"
                  >
                    {loading ? 'Processing...' : 'Take Loan'}
                  </button>
                  <button
                    onClick={() => setShowApplyBank(false)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showApplyFriend && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-2xl w-full max-w-md"
            >
              <h3 className="text-xl font-bold mb-4">Borrow from Friend</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Friend UPI ID</label>
                  <input
                    type="text"
                    value={friendLoan.upiId}
                    onChange={(e) => setFriendLoan({ ...friendLoan, upiId: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Principal (₹)</label>
                    <input
                      type="number"
                      value={friendLoan.principal}
                      onChange={(e) => setFriendLoan({ ...friendLoan, principal: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interest (%)</label>
                    <input
                      type="number"
                      value={friendLoan.interest}
                      onChange={(e) => setFriendLoan({ ...friendLoan, interest: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Min)</label>
                    <input
                      type="number"
                      value={friendLoan.duration}
                      onChange={(e) => setFriendLoan({ ...friendLoan, duration: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={friendLoan.pin}
                      onChange={(e) => setFriendLoan({ ...friendLoan, pin: e.target.value })}
                      className="w-full p-2 border rounded-lg text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Friend's PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={friendLoan.lenderPin}
                      onChange={(e) => setFriendLoan({ ...friendLoan, lenderPin: e.target.value })}
                      className="w-full p-2 border rounded-lg text-center"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleFriendLoan}
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium"
                  >
                    {loading ? 'Processing...' : 'Request Loan'}
                  </button>
                  <button
                    onClick={() => setShowApplyFriend(false)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
