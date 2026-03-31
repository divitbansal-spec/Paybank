import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  runTransaction,
  serverTimestamp,
  increment,
  deleteDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, AadhaarRecord, Transaction, OperationType, FirestoreErrorInfo, Group, Loan, MarketProduct, SystemStats } from '../types';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const bankService = {
  async createAadhaar(aadhaarNumber?: string): Promise<AadhaarRecord> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    // Check if this Aadhaar already exists
    if (aadhaarNumber) {
      try {
        const q = query(collection(db, 'aadhaar'), where('aadhaarNumber', '==', aadhaarNumber));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existing = snapshot.docs[0].data() as AadhaarRecord;
          // Update userId if it's different
          if (existing.userId !== userId) {
            await updateDoc(doc(db, 'aadhaar', existing.id), { userId });
          }
          return { ...existing, userId };
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'aadhaar');
      }
    }

    const number = aadhaarNumber || Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const aadhaarId = doc(collection(db, 'aadhaar')).id;
    
    const record: AadhaarRecord = {
      id: aadhaarId,
      aadhaarNumber: number,
      userId,
      createdAt: Date.now(),
    };

    try {
      await setDoc(doc(db, 'aadhaar', aadhaarId), record);
      return record;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `aadhaar/${aadhaarId}`);
      throw error;
    }
  },

  async changePin(oldPin: string, newPin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User not found');
        const userData = userDoc.data() as UserProfile;
        if (userData.pin !== oldPin) throw new Error('Incorrect current PIN');
        transaction.update(userRef, { pin: newPin });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  },

  async loginWithAadhaar(aadhaarNumber: string): Promise<UserProfile | null> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      // 1. Find Aadhaar record
      const q = query(collection(db, 'aadhaar'), where('aadhaarNumber', '==', aadhaarNumber));
      const snapshot = await getDocs(q);
      
      console.log(`Login attempt with Aadhaar: ${aadhaarNumber}, found: ${!snapshot.empty}`);
      
      if (snapshot.empty) return null;

      const aadhaarRecord = snapshot.docs[0].data() as AadhaarRecord;
      const oldUserId = aadhaarRecord.userId;

      // 2. Find associated user profile
      // We search by aadhaarId because the userId (doc ID) might have changed or be different
      const userQ = query(collection(db, 'users'), where('aadhaarId', '==', aadhaarRecord.id));
      const userSnapshot = await getDocs(userQ);
      
      console.log(`User profile search for Aadhaar ID ${aadhaarRecord.id}, found: ${!userSnapshot.empty}`);
      
      if (userSnapshot.empty) return null;

      const existingProfile = userSnapshot.docs[0].data() as UserProfile;
      const oldDocId = userSnapshot.docs[0].id;
      console.log(`Existing profile found for user: ${existingProfile.name} (${existingProfile.id})`);
      
      // 3. Link to current user
      let newUpiId = existingProfile.upiId;
      const upiQuery = query(collection(db, 'users'), where('upiId', '==', newUpiId));
      const upiSnapshot = await getDocs(upiQuery);
      if (!upiSnapshot.empty) {
        newUpiId = `${newUpiId.split('@')[0]}${Math.floor(1000 + Math.random() * 9000)}@paybank`;
      }

      const newProfile: UserProfile = {
        ...existingProfile,
        id: userId, // Update to current uid
        upiId: newUpiId
      };

      await runTransaction(db, async (transaction) => {
        // Update Aadhaar record to point to new userId
        transaction.update(doc(db, 'aadhaar', aadhaarRecord.id), { userId });
        
        // Create new user document for current uid
        transaction.set(doc(db, 'users', userId), newProfile);
      });

      console.log(`Successfully linked Aadhaar ${aadhaarNumber} to new userId ${userId}`);
      return newProfile;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'login_with_aadhaar');
      throw error;
    }
  },

  async signup(name: string, email: string, aadhaarId: string, isGenerated: boolean = false): Promise<UserProfile> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let upiId = `${username}@paybank`;
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    try {
      // Check if UPI ID is taken
      const upiQuery = query(collection(db, 'users'), where('upiId', '==', upiId));
      const upiSnapshot = await getDocs(upiQuery);
      if (!upiSnapshot.empty) {
        // Append random numbers to make it unique
        upiId = `${username}${Math.floor(1000 + Math.random() * 9000)}@paybank`;
      }

      const profile: UserProfile = {
        id: userId,
        name,
        email,
        balance: isGenerated ? 10000 - 99 : 10000,
        upiId,
        accountNumber,
        aadhaarId,
        upiCustom: false,
        upiSubscriptionEnd: 0,
        uiSubscriptionEnd: 0,
        depositCount: 0,
        depositResetTime: Date.now() + 60 * 60 * 1000, // 1 hour reset
        lastBillingTime: Date.now(),
        createdAt: Date.now(),
        role: email === 'divitbansal@gmail.com' ? 'admin' : 'user',
      };

      await setDoc(doc(db, 'users', userId), profile);
      return profile;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
      throw error;
    }
  },

  async getAadhaar(aadhaarId: string): Promise<AadhaarRecord | null> {
    try {
      const docRef = doc(db, 'aadhaar', aadhaarId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as AadhaarRecord;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `aadhaar/${aadhaarId}`);
      throw error;
    }
  },

  async transfer(toUpiId: string, amount: number, pin: string, note?: string): Promise<void> {
    const senderId = auth.currentUser?.uid;
    if (!senderId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const senderDoc = await transaction.get(doc(db, 'users', senderId));
        if (!senderDoc.exists()) throw new Error('Sender profile not found');
        const senderData = senderDoc.data() as UserProfile;

        if (senderData.isBanned) throw new Error('Account is banned');

        // Check if group is paused
        if (senderData.groupId) {
          const groupDoc = await transaction.get(doc(db, 'groups', senderData.groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (groupData.isPaused && !(groupData.resumedBy || []).includes(senderId)) {
              throw new Error('Game is paused. Please enter your PIN to resume.');
            }
          }
        }

        if (senderData.pin !== pin) throw new Error('Incorrect PIN');
        if (senderData.balance < amount) throw new Error('Insufficient balance');

        // Find receiver ID outside the transaction's consistent read but inside the callback is fine for query
        const receiverQuery = query(collection(db, 'users'), where('upiId', '==', toUpiId));
        const receiverSnapshot = await getDocs(receiverQuery);
        if (receiverSnapshot.empty) throw new Error('Receiver UPI ID not found');
        const receiverDoc = receiverSnapshot.docs[0];
        const receiverId = receiverDoc.id;

        if (senderId === receiverId) throw new Error('Cannot transfer to yourself');

        const txId = doc(collection(db, 'transactions')).id;
        const tx: Transaction = {
          id: txId,
          senderId,
          receiverId,
          amount,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
          note
        };

        transaction.update(doc(db, 'users', senderId), { 
          balance: increment(-amount),
          pin: pin // Include PIN to authorize balance decrease
        });
        transaction.update(doc(db, 'users', receiverId), { balance: increment(amount) });
        transaction.set(doc(db, 'transactions', txId), tx);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transaction_transfer');
      throw error;
    }
  },

  async deposit(amount: number, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.isBanned) throw new Error('Account is banned');

        // Check if group is paused
        if (userData.groupId) {
          const groupDoc = await transaction.get(doc(db, 'groups', userData.groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (groupData.isPaused && !(groupData.resumedBy || []).includes(userId)) {
              throw new Error('Game is paused. Please enter your PIN to resume.');
            }
          }
        }

        if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');

        const now = Date.now();
        let depositCount = userData.depositCount;
        let depositResetTime = userData.depositResetTime;

        if (now > depositResetTime) {
          depositCount = 0;
          depositResetTime = now + 60 * 60 * 1000;
        }

        let charge = 0;
        if (depositCount >= 5) {
          charge = 29;
        }

        if (userData.balance < charge) throw new Error('Insufficient balance for deposit fee');

        const txId = doc(collection(db, 'transactions')).id;
        const tx: Transaction = {
          id: txId,
          senderId: 'SYSTEM',
          receiverId: userId,
          amount: amount - charge,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
        };

        const netDeposit = amount - charge;
        const newBalance = Math.round((userData.balance + netDeposit) * 100) / 100;

        transaction.update(doc(db, 'users', userId), {
          balance: newBalance,
          depositCount: depositCount + 1,
          depositResetTime,
          pin: pin // Include PIN to authorize balance decrease (for fee)
        });
        transaction.set(doc(db, 'transactions', txId), tx);

        // Pause group if in one
        if (userData.groupId) {
          transaction.update(doc(db, 'groups', userData.groupId), {
            isPaused: true,
            pausedBy: userId,
            resumedBy: [] 
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/deposit`);
      throw error;
    }
  },

  async updateUpi(customUpi: string, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      // Check if custom UPI is unique outside the transaction
      const upiQuery = query(collection(db, 'users'), where('upiId', '==', customUpi));
      const upiSnapshot = await getDocs(upiQuery);
      
      // If found, check if it's not the current user's UPI
      if (!upiSnapshot.empty) {
        const existingUser = upiSnapshot.docs[0].data() as UserProfile;
        if (existingUser.id !== userId) {
          throw new Error('UPI ID already taken by another user');
        }
      }

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');
        if (userData.balance < 50) throw new Error('Insufficient balance for Premium UPI (₹50)');

        transaction.update(doc(db, 'users', userId), {
          upiId: customUpi,
          upiCustom: true,
          upiSubscriptionEnd: Date.now() + 5 * 60 * 1000, // 5 minutes
          balance: increment(-50),
        });

        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: userId,
          receiverId: 'SYSTEM',
          amount: 50,
          status: 'success',
          timestamp: Date.now(),
          type: 'fee',
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/upi`);
      throw error;
    }
  },

  async subscribeUi(pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');
        if (userData.balance < 99) throw new Error('Insufficient balance for Premium UI (₹99)');

        const newBalance = Math.round((userData.balance - 99) * 100) / 100;
        transaction.update(doc(db, 'users', userId), {
          uiSubscriptionEnd: Date.now() + 5 * 60 * 1000, // 5 minutes
          balance: newBalance,
        });

        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: userId,
          receiverId: 'SYSTEM',
          amount: 99,
          status: 'success',
          timestamp: Date.now(),
          type: 'fee',
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/ui`);
      throw error;
    }
  },

  async runBilling(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) return;
        const userData = userDoc.data() as UserProfile;

        const now = Date.now();
        // Billing runs every 5 minutes (simulated month)
        if (now - userData.lastBillingTime < 5 * 60 * 1000) return;

        let charge = 0;
        const balance = userData.balance;

        if (balance > 10000 && balance <= 20000) {
          charge = 49;
        } else if (balance > 20000 && balance < 100000) {
          const slabs = Math.floor((balance - 20000) / 5000);
          charge = slabs * 29;
        }

        const updates: any = {
          lastBillingTime: now,
          balance: userData.balance,
        };

        if (charge > 0) {
          updates.balance = Math.round((updates.balance - charge) * 100) / 100;
        }

        // Check subscription expiry and auto-renew
        if (userData.upiCustom && now > userData.upiSubscriptionEnd) {
          if (updates.balance >= 50) {
            updates.balance = Math.round((updates.balance - 50) * 100) / 100;
            updates.upiSubscriptionEnd = now + 5 * 60 * 1000;
            
            const txId = doc(collection(db, 'transactions')).id;
            transaction.set(doc(db, 'transactions', txId), {
              id: txId,
              senderId: userId,
              receiverId: 'SYSTEM',
              amount: 50,
              status: 'success',
              timestamp: Date.now(),
              type: 'fee',
              note: 'Auto-renewal: Premium UPI'
            });
          } else {
            const defaultUpi = `${userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@paybank`;
            updates.upiId = defaultUpi;
            updates.upiCustom = false;
          }
        }

        if (userData.uiSubscriptionEnd > 0 && now > userData.uiSubscriptionEnd) {
          if (updates.balance >= 99) {
            updates.balance = Math.round((updates.balance - 99) * 100) / 100;
            updates.uiSubscriptionEnd = now + 5 * 60 * 1000;

            const txId = doc(collection(db, 'transactions')).id;
            transaction.set(doc(db, 'transactions', txId), {
              id: txId,
              senderId: userId,
              receiverId: 'SYSTEM',
              amount: 99,
              status: 'success',
              timestamp: Date.now(),
              type: 'fee',
              note: 'Auto-renewal: Premium UI'
            });
          } else {
            updates.uiSubscriptionEnd = 0;
          }
        }

        transaction.update(doc(db, 'users', userId), updates);

        if (charge > 0) {
          const txId = doc(collection(db, 'transactions')).id;
          transaction.set(doc(db, 'transactions', txId), {
            id: txId,
            senderId: userId,
            receiverId: 'GOVT_TAX',
            amount: charge,
            status: 'success',
            timestamp: Date.now(),
            type: 'tax',
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/billing`);
    }
  },

  async buyAsset(assetId: string, assetName: string, price: number, quantity: number, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    const totalCost = price * quantity;

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.isBanned) throw new Error('Account is banned');

        // Check if group is paused
        if (userData.groupId) {
          const groupDoc = await transaction.get(doc(db, 'groups', userData.groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (groupData.isPaused && !(groupData.resumedBy || []).includes(userId)) {
              throw new Error('Game is paused. Please enter your PIN to resume.');
            }
          }
        }

        if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');
        if (userData.balance < totalCost) throw new Error('Insufficient balance');

        const currentHoldings = userData.holdings || {};
        const newHoldings = {
          ...currentHoldings,
          [assetId]: (currentHoldings[assetId] || 0) + quantity
        };

        const txId = doc(collection(db, 'transactions')).id;
        const tx: Transaction = {
          id: txId,
          senderId: userId,
          receiverId: 'MARKET',
          amount: totalCost,
          status: 'success',
          timestamp: Date.now(),
          type: 'buy',
          assetId,
          assetName,
          assetPrice: price
        };

        const newBalance = Math.round((userData.balance - totalCost) * 100) / 100;
        transaction.update(doc(db, 'users', userId), { 
          balance: newBalance,
          holdings: newHoldings
        });
        transaction.set(doc(db, 'transactions', txId), tx);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'buy_asset');
      throw error;
    }
  },

  async sellAsset(assetId: string, assetName: string, price: number, quantity: number, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    const totalCredit = price * quantity;

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.isBanned) throw new Error('Account is banned');

        // Check if group is paused
        if (userData.groupId) {
          const groupDoc = await transaction.get(doc(db, 'groups', userData.groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (groupData.isPaused && !(groupData.resumedBy || []).includes(userId)) {
              throw new Error('Game is paused. Please enter your PIN to resume.');
            }
          }
        }

        if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');

        const currentHoldings = userData.holdings || {};
        if ((currentHoldings[assetId] || 0) < quantity) throw new Error('Insufficient holdings');

        const newHoldings = {
          ...currentHoldings,
          [assetId]: currentHoldings[assetId] - quantity
        };

        const txId = doc(collection(db, 'transactions')).id;
        const tx: Transaction = {
          id: txId,
          senderId: 'MARKET',
          receiverId: userId,
          amount: totalCredit,
          status: 'success',
          timestamp: Date.now(),
          type: 'sell',
          assetId,
          assetName,
          assetPrice: price
        };

        const newBalance = Math.round((userData.balance + totalCredit) * 100) / 100;
        transaction.update(doc(db, 'users', userId), { 
          balance: newBalance,
          holdings: newHoldings
        });
        transaction.set(doc(db, 'transactions', txId), tx);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sell_asset');
      throw error;
    }
  },

  async setPremiumTheme(theme: 'midnight' | 'emerald' | 'ruby' | 'gold' | 'neon' | 'sunset' | 'ocean' | 'cyber'): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) throw new Error('User profile not found');
      const userData = userDoc.data() as UserProfile;

      if (!userData.uiSubscriptionEnd || userData.uiSubscriptionEnd < Date.now()) {
        throw new Error('Premium UI subscription required');
      }

      await updateDoc(doc(db, 'users', userId), { premiumTheme: theme });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/theme`);
      throw error;
    }
  },

  async setPin(pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');

    try {
      await updateDoc(doc(db, 'users', userId), { pin });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/pin`);
      throw error;
    }
  },

  async cancelUiSubscription(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    console.log('Cancelling UI subscription for:', userId);
    try {
      await updateDoc(doc(db, 'users', userId), { uiSubscriptionEnd: 0 });
      console.log('UI subscription cancelled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  },

  async cancelUpiSubscription(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    console.log('Cancelling UPI subscription for:', userId);
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) throw new Error('User profile not found');
      const userData = userDoc.data() as UserProfile;

      const defaultUpi = `${userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@paybank`;
      await updateDoc(doc(db, 'users', userId), { 
        upiId: defaultUpi,
        upiCustom: false,
        upiSubscriptionEnd: 0 
      });
      console.log('UPI subscription cancelled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  },

  async createGroup(name: string): Promise<Group> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const groupId = doc(collection(db, 'groups')).id;
    const group: Group = {
      id: groupId,
      name,
      ownerId: userId,
      members: [userId],
      pendingInvites: [],
      isPaused: false,
      createdAt: Date.now(),
    };

    try {
      await runTransaction(db, async (transaction) => {
        transaction.set(doc(db, 'groups', groupId), group);
        transaction.update(doc(db, 'users', userId), { groupId });
      });
      return group;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}`);
      throw error;
    }
  },

  async inviteToGroup(groupId: string, aadhaarNumber: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) throw new Error('Group not found');
      const groupData = groupDoc.data() as Group;

      if (groupData.ownerId !== userId) throw new Error('Only the group owner can invite members');
      if (groupData.pendingInvites.includes(aadhaarNumber)) throw new Error('Invite already pending');

      // Check if user with this Aadhaar exists
      const q = query(collection(db, 'aadhaar'), where('aadhaarNumber', '==', aadhaarNumber));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('User with this Aadhaar not found');

      await updateDoc(doc(db, 'groups', groupId), {
        pendingInvites: [...groupData.pendingInvites, aadhaarNumber]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/invite`);
      throw error;
    }
  },

  async joinGroup(groupId: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        const aadhaarDoc = await transaction.get(doc(db, 'aadhaar', userData.aadhaarId));
        if (!aadhaarDoc.exists()) throw new Error('Aadhaar record not found');
        const aadhaarData = aadhaarDoc.data() as AadhaarRecord;

        const groupDoc = await transaction.get(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');
        const groupData = groupDoc.data() as Group;

        if (!groupData.pendingInvites.includes(aadhaarData.aadhaarNumber)) {
          throw new Error('No pending invite for this group');
        }

        transaction.update(doc(db, 'groups', groupId), {
          members: [...groupData.members, userId],
          pendingInvites: groupData.pendingInvites.filter(a => a !== aadhaarData.aadhaarNumber)
        });
        transaction.update(doc(db, 'users', userId), { groupId });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/join`);
      throw error;
    }
  },

  async leaveGroup(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (!userData.groupId) throw new Error('Not in a group');

        const groupDoc = await transaction.get(doc(db, 'groups', userData.groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');
        const groupData = groupDoc.data() as Group;

        if (groupData.ownerId === userId) {
          // If owner leaves, delete group or transfer ownership? User said "leave too". 
          // Let's delete if owner leaves for simplicity, or just remove from members.
          // User said "leave too", usually implies members can leave.
        }

        transaction.update(doc(db, 'groups', userData.groupId), {
          members: groupData.members.filter(m => m !== userId)
        });
        transaction.update(doc(db, 'users', userId), { groupId: null });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leave_group');
      throw error;
    }
  },

  async resumeGroupGame(pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.pin !== pin) throw new Error('Incorrect PIN');
        if (!userData.groupId) throw new Error('Not in a group');

        const groupDoc = await transaction.get(doc(db, 'groups', userData.groupId));
        if (!groupDoc.exists()) throw new Error('Group not found');
        const groupData = groupDoc.data() as Group;

        if (!groupData.isPaused) return;

        const resumedBy = groupData.resumedBy || [];
        if (resumedBy.includes(userId)) return;

        const newResumedBy = [...resumedBy, userId];
        
        // If all members have resumed, unpause the group
        if (newResumedBy.length === groupData.members.length) {
          transaction.update(doc(db, 'groups', userData.groupId), {
            isPaused: false,
            pausedBy: null,
            resumedBy: []
          });
        } else {
          transaction.update(doc(db, 'groups', userData.groupId), {
            resumedBy: newResumedBy
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'resume_group_game');
      throw error;
    }
  },

  async addMarketProduct(name: string, price: number, description: string, image?: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) throw new Error('User profile not found');
      const userData = userDoc.data() as UserProfile;

      if (!userData.groupId) throw new Error('Must be in a group to add products');

      const productId = doc(collection(db, 'marketplace')).id;
      const product: MarketProduct = {
        id: productId,
        sellerId: userId,
        groupId: userData.groupId,
        name,
        price,
        createdAt: Date.now(),
      };

      if (description) {
        product.description = description;
      }

      if (image) {
        product.image = image;
      }

      await setDoc(doc(db, 'marketplace', productId), product);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'add_market_product');
      throw error;
    }
  },

  async buyMarketProduct(productId: string, pin: string): Promise<void> {
    const buyerId = auth.currentUser?.uid;
    if (!buyerId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const buyerDoc = await transaction.get(doc(db, 'users', buyerId));
        if (!buyerDoc.exists()) throw new Error('Buyer profile not found');
        const buyerData = buyerDoc.data() as UserProfile;

        if (buyerData.pin !== pin) throw new Error('Incorrect PIN');

        const productDoc = await transaction.get(doc(db, 'marketplace', productId));
        if (!productDoc.exists()) throw new Error('Product not found');
        const productData = productDoc.data() as MarketProduct;

        if (buyerData.balance < productData.price) throw new Error('Insufficient balance');

        const sellerDoc = await transaction.get(doc(db, 'users', productData.sellerId));
        if (!sellerDoc.exists()) throw new Error('Seller profile not found');
        const sellerData = sellerDoc.data() as UserProfile;

        const bankShare = Math.round((productData.price * 0.15) * 100) / 100;
        const sellerShare = Math.round((productData.price * 0.85) * 100) / 100;

        const newBuyerBalance = Math.round((buyerData.balance - productData.price) * 100) / 100;
        const newSellerBalance = Math.round((sellerData.balance + sellerShare) * 100) / 100;

        transaction.update(doc(db, 'users', buyerId), { balance: newBuyerBalance });
        transaction.update(doc(db, 'users', productData.sellerId), { balance: newSellerBalance });
        
        // Record transactions
        // 1. Transfer to seller (sellerShare)
        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: buyerId,
          receiverId: productData.sellerId,
          amount: sellerShare,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
          note: `Marketplace: ${productData.name}`
        });

        // 2. Bank fee (bankShare)
        const feeTxId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', feeTxId), {
          id: feeTxId,
          senderId: buyerId,
          receiverId: 'SYSTEM',
          amount: bankShare,
          status: 'success',
          timestamp: Date.now(),
          type: 'fee',
          note: `Marketplace fee: ${productData.name}`
        });

        transaction.delete(doc(db, 'marketplace', productId));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'buy_market_product');
      throw error;
    }
  },

  async takeBankLoan(principal: number, durationMinutes: number, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    if (principal > 100000) throw new Error('LOAN_ERROR: Max bank loan is ₹1,00,000');
    if (durationMinutes > 60) throw new Error('LOAN_ERROR: Max duration is 60 minutes (1 year)');

    try {
      // Check for existing active loans
      const activeLoansQuery = query(collection(db, 'loans'), where('borrowerId', '==', userId), where('status', '==', 'active'));
      const activeLoansSnapshot = await getDocs(activeLoansQuery);
      if (!activeLoansSnapshot.empty) throw new Error('LOAN_ERROR: You already have an active loan. Please repay it first.');

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('LOAN_ERROR: User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.isBanned) throw new Error('LOAN_ERROR: Account is banned. Cannot apply for loans.');
        if (userData.pin && userData.pin !== pin) throw new Error('LOAN_ERROR: Incorrect PIN');

        const loanId = doc(collection(db, 'loans')).id;
        const interestRate = 0.08; // 8%
        const totalToPay = principal * (1 + interestRate);
        const monthlyInstallment = Math.round((totalToPay / 12) * 100) / 100;

        const loan: Loan = {
          id: loanId,
          borrowerId: userId,
          lenderId: 'BANK',
          principal,
          interestRate,
          duration: durationMinutes,
          startTime: Date.now(),
          nextPaymentTime: Date.now() + (durationMinutes / 12) * 60 * 1000,
          status: 'active',
          missedPayments: 0,
          fine: 0,
          totalRepaid: 0,
          monthlyInstallment
        };

        transaction.set(doc(db, 'loans', loanId), loan);
        transaction.update(doc(db, 'users', userId), { 
          balance: Math.round((userData.balance + principal) * 100) / 100 
        });

        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: 'BANK',
          receiverId: userId,
          amount: principal,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
          note: 'Bank Loan Disbursed',
          loanId: loanId
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'take_bank_loan');
      throw error;
    }
  },

  async takeFriendLoan(friendUpiId: string, principal: number, interestRate: number, durationMinutes: number, borrowerPin: string, lenderPin: string): Promise<void> {
    const borrowerId = auth.currentUser?.uid;
    if (!borrowerId) throw new Error('User not authenticated');

    try {
      // Find lender ID first outside the transaction
      const lenderQuery = query(collection(db, 'users'), where('upiId', '==', friendUpiId));
      const lenderSnapshot = await getDocs(lenderQuery);
      if (lenderSnapshot.empty) throw new Error('LOAN_ERROR: Friend UPI ID not found');
      const lenderId = lenderSnapshot.docs[0].id;

      if (borrowerId === lenderId) throw new Error('LOAN_ERROR: Cannot borrow from yourself');

      // Check for existing active loans
      const activeLoansQuery = query(collection(db, 'loans'), where('borrowerId', '==', borrowerId), where('status', '==', 'active'));
      const activeLoansSnapshot = await getDocs(activeLoansQuery);
      if (!activeLoansSnapshot.empty) throw new Error('LOAN_ERROR: You already have an active loan. Please repay it first.');

      await runTransaction(db, async (transaction) => {
        const borrowerDoc = await transaction.get(doc(db, 'users', borrowerId));
        if (!borrowerDoc.exists()) throw new Error('LOAN_ERROR: Borrower profile not found');
        const borrowerData = borrowerDoc.data() as UserProfile;

        if (borrowerData.isBanned) throw new Error('LOAN_ERROR: Account is banned. Cannot apply for loans.');
        if (borrowerData.pin !== borrowerPin) throw new Error('LOAN_ERROR: Incorrect Borrower PIN');

        const lenderDoc = await transaction.get(doc(db, 'users', lenderId));
        if (!lenderDoc.exists()) throw new Error('LOAN_ERROR: Lender profile not found');
        const lenderData = lenderDoc.data() as UserProfile;

        if (lenderData.pin !== lenderPin) throw new Error('LOAN_ERROR: Incorrect Friend (Lender) PIN');
        if (lenderData.balance < principal) {
          throw new Error(`LOAN_ERROR: Friend has insufficient balance (Current: ₹${lenderData.balance}, Requested: ₹${principal})`);
        }

        const loanId = doc(collection(db, 'loans')).id;
        const totalToPay = principal * (1 + interestRate / 100);
        const monthlyInstallment = Math.round((totalToPay / 12) * 100) / 100;

        const loan: Loan = {
          id: loanId,
          borrowerId,
          lenderId,
          principal,
          interestRate,
          duration: durationMinutes,
          startTime: Date.now(),
          nextPaymentTime: Date.now() + (durationMinutes / 12) * 60 * 1000,
          status: 'active',
          missedPayments: 0,
          fine: 0,
          totalRepaid: 0,
          monthlyInstallment,
          lenderPinRequired: true
        };

        transaction.set(doc(db, 'loans', loanId), loan);
        transaction.update(doc(db, 'users', borrowerId), { 
          balance: Math.round((borrowerData.balance + principal) * 100) / 100 
        });
        transaction.update(doc(db, 'users', lenderId), { 
          balance: Math.round((lenderData.balance - principal) * 100) / 100,
          pin: lenderPin // Include PIN to authorize balance decrease in rules
        });

        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: lenderId,
          receiverId: borrowerId,
          amount: principal,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
          note: 'Friend Loan Disbursed',
          loanId: loanId
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'take_friend_loan');
      throw error;
    }
  },

  async processLoans(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const q = query(collection(db, 'loans'), where('borrowerId', '==', userId), where('status', '==', 'active'));
      const snapshot = await getDocs(q);

      for (const loanDoc of snapshot.docs) {
        const loan = loanDoc.data() as Loan;
        const now = Date.now();

        if (now >= loan.nextPaymentTime) {
          await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(doc(db, 'users', userId));
            if (!userDoc.exists()) return;
            const userData = userDoc.data() as UserProfile;

            let lenderDoc;
            if (loan.lenderId !== 'BANK') {
              lenderDoc = await transaction.get(doc(db, 'users', loan.lenderId));
            }

            const amountToPay = loan.monthlyInstallment + loan.fine;
            
            if (userData.balance >= amountToPay) {
              // Pay installment
              const newBalance = Math.round((userData.balance - amountToPay) * 100) / 100;
              const newTotalRepaid = Math.round((loan.totalRepaid + loan.monthlyInstallment) * 100) / 100;
              
              const isFullyPaid = newTotalRepaid >= (loan.principal * (1 + loan.interestRate / (loan.lenderId === 'BANK' ? 1 : 100)));

              transaction.update(doc(db, 'users', userId), { balance: newBalance });
              transaction.update(doc(db, 'loans', loan.id), {
                totalRepaid: newTotalRepaid,
                fine: 0,
                missedPayments: 0,
                nextPaymentTime: isFullyPaid ? 0 : now + (loan.duration / 12) * 60 * 1000,
                status: isFullyPaid ? 'paid' : 'active'
              });

              if (loan.lenderId !== 'BANK' && lenderDoc?.exists()) {
                const lenderData = lenderDoc.data() as UserProfile;
                transaction.update(doc(db, 'users', loan.lenderId), {
                  balance: Math.round((lenderData.balance + amountToPay) * 100) / 100
                });
              }

              const txId = doc(collection(db, 'transactions')).id;
              transaction.set(doc(db, 'transactions', txId), {
                id: txId,
                senderId: userId,
                receiverId: loan.lenderId,
                amount: amountToPay,
                status: 'success',
                timestamp: Date.now(),
                type: 'transfer',
                note: `Loan Repayment: ${loan.lenderId === 'BANK' ? 'Bank' : 'Friend'}`,
                loanId: loan.id
              });
            } else {
              // Default logic - 6 Stages
              let newMissedPayments = loan.missedPayments + 1;
              let newFine = loan.fine;
              let newStatus = loan.status;
              let addedFine = 0;

              if (loan.lenderId === 'BANK') {
                if (newMissedPayments === 1) addedFine = 99;
                else if (newMissedPayments === 2) addedFine = 199;
                else if (newMissedPayments === 3) addedFine = 499;
                else if (newMissedPayments === 4) addedFine = 999;
                else if (newMissedPayments === 5) {
                  // Stage 5: All Account Money Goes Zero
                  addedFine = userData.balance;
                  transaction.update(doc(db, 'users', userId), { balance: 0 });
                } else if (newMissedPayments >= 6) {
                  // Stage 6: Account Ban
                  newStatus = 'banned';
                  transaction.update(doc(db, 'users', userId), { isBanned: true });
                }
                newFine += addedFine;
              } else {
                // Friend loan fine - also 6 stages but directed to friend
                if (newMissedPayments === 1) addedFine = 99;
                else if (newMissedPayments === 2) addedFine = 199;
                else if (newMissedPayments === 3) addedFine = 499;
                else if (newMissedPayments === 4) addedFine = 999;
                else if (newMissedPayments === 5) {
                  addedFine = userData.balance;
                  transaction.update(doc(db, 'users', userId), { balance: 0 });
                } else if (newMissedPayments >= 6) {
                  newStatus = 'banned';
                  transaction.update(doc(db, 'users', userId), { isBanned: true });
                }
                newFine += addedFine;

                if (addedFine > 0 && lenderDoc?.exists()) {
                  const lenderData = lenderDoc.data() as UserProfile;
                  transaction.update(doc(db, 'users', loan.lenderId), {
                    balance: Math.round((lenderData.balance + addedFine) * 100) / 100
                  });
                }
              }

              transaction.update(doc(db, 'loans', loan.id), {
                missedPayments: newMissedPayments,
                fine: newFine,
                status: newStatus,
                nextPaymentTime: now + 2.5 * 60 * 1000 // Every 2.5 minutes fine will deduct
              });
            }
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/processLoans`);
    }
  },

  async unbanFriendLoan(loanId: string, lenderPin: string): Promise<void> {
    const lenderId = auth.currentUser?.uid;
    if (!lenderId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const lenderDoc = await transaction.get(doc(db, 'users', lenderId));
        if (!lenderDoc.exists()) throw new Error('Lender profile not found');
        const lenderData = lenderDoc.data() as UserProfile;

        if (lenderData.pin !== lenderPin) throw new Error('Incorrect PIN');

        const loanDoc = await transaction.get(doc(db, 'loans', loanId));
        if (!loanDoc.exists()) throw new Error('Loan not found');
        const loanData = loanDoc.data() as Loan;

        if (loanData.lenderId !== lenderId) throw new Error('Only the lender can unban the borrower');

        transaction.update(doc(db, 'loans', loanId), { status: 'active', missedPayments: 0, fine: 0 });
        transaction.update(doc(db, 'users', loanData.borrowerId), { isBanned: false });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'unban_friend_loan');
      throw error;
    }
  },

  async repayBannedFriendLoan(loanId: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        const loanDoc = await transaction.get(doc(db, 'loans', loanId));
        if (!loanDoc.exists()) throw new Error('Loan not found');
        const loanData = loanDoc.data() as Loan;

        const totalOwed = (loanData.principal * (1 + loanData.interestRate / 100)) - loanData.totalRepaid + loanData.fine;
        
        if (userData.balance < totalOwed) throw new Error(`LOAN_ERROR: Insufficient balance to pay off loan. Need ₹${totalOwed.toLocaleString()}`);

        const lenderDoc = await transaction.get(doc(db, 'users', loanData.lenderId));
        if (!lenderDoc.exists()) throw new Error('Lender profile not found');
        const lenderData = lenderDoc.data() as UserProfile;

        transaction.update(doc(db, 'users', userId), { 
          balance: Math.round((userData.balance - totalOwed) * 100) / 100,
          isBanned: false 
        });
        transaction.update(doc(db, 'users', loanData.lenderId), {
          balance: Math.round((lenderData.balance + totalOwed) * 100) / 100
        });
        transaction.update(doc(db, 'loans', loanId), {
          status: 'paid',
          totalRepaid: loanData.principal * (1 + loanData.interestRate / 100),
          fine: 0
        });

        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: userId,
          receiverId: loanData.lenderId,
          amount: totalOwed,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
          note: 'Banned Friend Loan Repayment',
          loanId: loanId
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'repay_banned_friend_loan');
      throw error;
    }
  },

  async repayBannedBankLoan(loanId: string, payerPin: string): Promise<void> {
    const payerId = auth.currentUser?.uid;
    if (!payerId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const payerDoc = await transaction.get(doc(db, 'users', payerId));
        if (!payerDoc.exists()) throw new Error('Payer profile not found');
        const payerData = payerDoc.data() as UserProfile;

        if (payerData.pin !== payerPin) throw new Error('LOAN_ERROR: Incorrect PIN');

        const loanDoc = await transaction.get(doc(db, 'loans', loanId));
        if (!loanDoc.exists()) throw new Error('Loan not found');
        const loanData = loanDoc.data() as Loan;

        const borrowerDoc = await transaction.get(doc(db, 'users', loanData.borrowerId));
        if (!borrowerDoc.exists()) throw new Error('Borrower profile not found');
        const borrowerData = borrowerDoc.data() as UserProfile;

        // Check if payer is in the same group
        if (payerData.groupId !== borrowerData.groupId) throw new Error('LOAN_ERROR: Only group members can pay for a banned bank loan');

        const totalOwed = (loanData.principal * (1 + loanData.interestRate)) - loanData.totalRepaid + loanData.fine;

        if (payerData.balance < totalOwed) throw new Error(`LOAN_ERROR: Insufficient balance. Need ₹${totalOwed.toLocaleString()}`);

        transaction.update(doc(db, 'users', payerId), {
          balance: Math.round((payerData.balance - totalOwed) * 100) / 100,
          pin: payerPin
        });
        transaction.update(doc(db, 'users', loanData.borrowerId), {
          isBanned: false
        });
        transaction.update(doc(db, 'loans', loanId), {
          status: 'paid',
          totalRepaid: loanData.principal * (1 + loanData.interestRate),
          fine: 0
        });

        const txId = doc(collection(db, 'transactions')).id;
        transaction.set(doc(db, 'transactions', txId), {
          id: txId,
          senderId: payerId,
          receiverId: 'BANK',
          amount: totalOwed,
          status: 'success',
          timestamp: Date.now(),
          type: 'transfer',
          note: `Banned Bank Loan Repayment for ${borrowerData.name}`,
          loanId: loanId
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'repay_banned_bank_loan');
      throw error;
    }
  },

  async clearAllTransactions(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(db, 'transactions'));
      const batchSize = 500;
      let count = 0;
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = snapshot.docs.slice(i, i + batchSize);
        await Promise.all(batch.map(d => deleteDoc(d.ref)));
        count += batch.length;
      }
      console.log(`Deleted ${count} transactions`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
      throw error;
    }
  },

  async pauseGame(durationMinutes: number, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) throw new Error('User profile not found');
      const userData = userDoc.data() as UserProfile;

      if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');

      await updateDoc(doc(db, 'users', userId), {
        isGamePaused: true,
        gamePauseEndTime: durationMinutes === -1 ? -1 : Date.now() + durationMinutes * 60 * 1000
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/pause`);
      throw error;
    }
  },

  async resumeGame(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await updateDoc(doc(db, 'users', userId), {
        isGamePaused: false,
        gamePauseEndTime: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/resume`);
      throw error;
    }
  },

  async withdraw(amount: number, pin: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) throw new Error('User profile not found');
        const userData = userDoc.data() as UserProfile;

        if (userData.isBanned) throw new Error('Account is banned');

        // Check if group is paused
        if (userData.groupId) {
          const groupDoc = await transaction.get(doc(db, 'groups', userData.groupId));
          if (groupDoc.exists()) {
            const groupData = groupDoc.data() as Group;
            if (groupData.isPaused && !(groupData.resumedBy || []).includes(userId)) {
              throw new Error('Game is paused. Please enter your PIN to resume.');
            }
          }
        }

        if (userData.pin && userData.pin !== pin) throw new Error('Incorrect PIN');

        const now = Date.now();
        let withdrawCount = userData.withdrawCount || 0;
        let withdrawResetTime = userData.withdrawResetTime || (now + 60 * 60 * 1000);

        if (now > withdrawResetTime) {
          withdrawCount = 0;
          withdrawResetTime = now + 60 * 60 * 1000;
        }

        let charge = 0;
        if (withdrawCount >= 3) {
          charge = 19;
        }

        const totalDebit = amount + charge;
        if (userData.balance < totalDebit) throw new Error('Insufficient balance for withdrawal and fee');

        const txId = doc(collection(db, 'transactions')).id;
        const tx: Transaction = {
          id: txId,
          senderId: userId,
          receiverId: 'SYSTEM',
          amount: amount,
          status: 'success',
          timestamp: Date.now(),
          type: 'withdraw',
        };

        const newBalance = Math.round((userData.balance - totalDebit) * 100) / 100;
        transaction.update(doc(db, 'users', userId), {
          balance: newBalance,
          withdrawCount: withdrawCount + 1,
          withdrawResetTime,
          pin: pin // Include PIN to authorize balance decrease
        });
        transaction.set(doc(db, 'transactions', txId), tx);

        if (charge > 0) {
          const feeTxId = doc(collection(db, 'transactions')).id;
          transaction.set(doc(db, 'transactions', feeTxId), {
            id: feeTxId,
            senderId: userId,
            receiverId: 'SYSTEM',
            amount: charge,
            status: 'success',
            timestamp: Date.now(),
            type: 'fee',
          });
        }

        // Pause group if in one
        if (userData.groupId) {
          transaction.update(doc(db, 'groups', userData.groupId), {
            isPaused: true,
            pausedBy: userId,
            resumedBy: []
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/withdraw`);
      throw error;
    }
  },

  async getSystemStats(): Promise<SystemStats> {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const txsSnap = await getDocs(collection(db, 'transactions'));
      const loansSnap = await getDocs(collection(db, 'loans'));

      let totalVolume = 0;
      txsSnap.docs.forEach(doc => {
        const tx = doc.data() as Transaction;
        if (tx.status === 'success') {
          totalVolume += tx.amount;
        }
      });

      let bankBalance = 0;
      usersSnap.docs.forEach(doc => {
        const user = doc.data() as UserProfile;
        bankBalance += user.balance;
      });

      const activeLoans = loansSnap.docs.filter(doc => (doc.data() as Loan).status === 'active').length;

      return {
        totalUsers: usersSnap.size,
        totalTransactions: txsSnap.size,
        totalVolume: Math.round(totalVolume * 100) / 100,
        bankBalance: Math.round(bankBalance * 100) / 100,
        activeLoans,
        totalLoansDisbursed: loansSnap.size,
        lastUpdated: Date.now()
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'system/stats');
      throw error;
    }
  },

  async getLoanRepayments(loanId: string): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('loanId', '==', loanId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Transaction);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `loans/${loanId}/repayments`);
      throw error;
    }
  }
};
