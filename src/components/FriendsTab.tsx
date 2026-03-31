import React, { useState, useEffect } from 'react';
import { bankService } from '../services/bankService';
import { Group, UserProfile, MarketProduct, AadhaarRecord, OperationType } from '../types';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, parseFirestoreError } from '../lib/error-handler';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { Users, UserPlus, LogOut, Pause, Play, ShoppingBag, Plus, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PinModal } from './PinModal';

interface FriendsTabProps {
  user: UserProfile;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({ user }) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [inviteAadhaar, setInviteAadhaar] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' });
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  useEffect(() => {
    if (user.groupId) {
      const unsub = onSnapshot(doc(db, 'groups', user.groupId), (snapshot) => {
        if (snapshot.exists()) {
          setGroup(snapshot.data() as Group);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `groups/${user.groupId}`);
      });
      return () => unsub();
    } else {
      setGroup(null);
    }
  }, [user.groupId]);

  useEffect(() => {
    if (group) {
      const unsub = onSnapshot(query(collection(db, 'users'), where('groupId', '==', group.id)), (snapshot) => {
        setGroupMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `groups/${group.id}/members`);
      });
      return () => unsub();
    }
  }, [group?.id]);

  useEffect(() => {
    if (group) {
      const unsub = onSnapshot(query(collection(db, 'marketplace'), where('groupId', '==', group.id)), (snapshot) => {
        setProducts(snapshot.docs.map(doc => doc.data() as MarketProduct));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `groups/${group.id}/marketplace`);
      });
      return () => unsub();
    }
  }, [group?.id]);

  useEffect(() => {
    const fetchInvites = async () => {
      const aadhaarDoc = await bankService.getAadhaar(user.aadhaarId);
      if (aadhaarDoc) {
        const unsub = onSnapshot(query(collection(db, 'groups'), where('pendingInvites', 'array-contains', aadhaarDoc.aadhaarNumber)), (snapshot) => {
          setPendingInvites(snapshot.docs.map(doc => doc.data() as Group));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'pending_invites');
        });
        return unsub;
      }
    };
    const unsubPromise = fetchInvites();
    return () => { unsubPromise.then(unsub => unsub?.()); };
  }, [user.aadhaarId]);

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    setLoading(true);
    try {
      await bankService.createGroup(newGroupName);
      setShowCreateGroup(false);
      setNewGroupName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteAadhaar || !group) return;
    setLoading(true);
    try {
      await bankService.inviteToGroup(group.id, inviteAadhaar);
      setInviteAadhaar('');
      setSuccess('Invite sent!');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (groupId: string) => {
    setLoading(true);
    try {
      await bankService.joinGroup(groupId);
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    try {
      await bankService.leaveGroup();
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!pin) return;
    setLoading(true);
    try {
      await bankService.resumeGroupGame(pin);
      setPin('');
      setShowPinModal(false);
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      setError('Please provide both name and price');
      return;
    }
    
    const price = parseFloat(newProduct.price);
    if (isNaN(price) || price < 0) {
      setError('Please provide a valid positive price');
      return;
    }

    setLoading(true);
    try {
      await bankService.addMarketProduct(newProduct.name, price, newProduct.description);
      setShowAddProduct(false);
      setNewProduct({ name: '', price: '', description: '' });
      setError(null);
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBuyProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsPinModalOpen(true);
  };

  const confirmBuyProduct = async (pinInput: string) => {
    if (!selectedProductId) return;
    setIsPinModalOpen(false);
    setLoading(true);
    try {
      await bankService.buyMarketProduct(selectedProductId, pinInput);
      setSuccess('Product bought successfully!');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
      setSelectedProductId(null);
    }
  };

  if (!user.groupId && pendingInvites.length === 0 && !showCreateGroup) {
    return (
      <div className="p-6 text-center">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-bold mb-2">No Group Found</h2>
        <p className="text-gray-500 mb-6">Create a group to share market prices and trade with friends.</p>
        <button
          onClick={() => setShowCreateGroup(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Create Group
        </button>
      </div>
    );
  }

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

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onConfirm={confirmBuyProduct}
        title="Confirm Purchase"
        description="Enter your 4-digit PIN to buy this product."
      />

      {showCreateGroup && !user.groupId && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4">Create New Group</h3>
          <input
            type="text"
            placeholder="Group Name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={handleCreateGroup}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreateGroup(false)}
              className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingInvites.length > 0 && !user.groupId && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Pending Invites
          </h3>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <p className="font-bold">{inv.name}</p>
                <p className="text-sm text-gray-500">{inv.members.length} members</p>
              </div>
              <button
                onClick={() => handleJoin(inv.id)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      )}

      {group && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{group.name}</h2>
              <p className="text-gray-500 text-sm">Group ID: {group.id}</p>
            </div>
            <button
              onClick={handleLeave}
              className="text-red-600 flex items-center gap-1 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" /> Leave
            </button>
          </div>

          {group.isPaused && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col items-center text-center space-y-3">
              <Pause className="w-8 h-8 text-amber-600 animate-pulse" />
              <div>
                <p className="font-bold text-amber-900">Game Paused</p>
                <p className="text-sm text-amber-700">A member is performing a sensitive transaction. Enter PIN to resume.</p>
              </div>
              {!(group.resumedBy || []).includes(user.id) ? (
                <div className="flex gap-2 w-full max-w-xs">
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="flex-1 p-2 border rounded-lg text-center font-mono"
                  />
                  <button
                    onClick={handleResume}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Resume
                  </button>
                </div>
              ) : (
                <p className="text-sm font-medium text-amber-600">Waiting for other members... ({group.resumedBy?.length}/{group.members.length})</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Members ({groupMembers.length})
                </h3>
                {group.ownerId === user.id && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Aadhaar No"
                      value={inviteAadhaar}
                      onChange={(e) => setInviteAadhaar(e.target.value)}
                      className="p-1 border rounded text-xs w-24"
                    />
                    <button
                      onClick={handleInvite}
                      className="bg-indigo-600 text-white p-1 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {groupMembers.map(member => (
                  <div key={member.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {member.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name} {member.id === group.ownerId && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">Owner</span>}</p>
                        <p className="text-[10px] text-gray-400">{member.upiId}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold">₹{member.balance.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  Marketplace
                </h3>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="text-indigo-600 text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Product
                </button>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {products.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No products listed yet.</p>
                ) : (
                  products.map(product => (
                    <div key={product.id} className="border rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{product.description}</p>
                        </div>
                        <p className="font-bold text-indigo-600">₹{product.price.toLocaleString()}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-gray-400">Seller: {groupMembers.find(m => m.id === product.sellerId)?.name || 'Unknown'}</p>
                        {product.sellerId !== user.id && (
                          <button
                            onClick={() => handleBuyProduct(product.id)}
                            className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-medium"
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">List New Product</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
                <p className="text-[10px] text-gray-500 mt-1">Note: 15% bank fee applies on sale.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full p-2 border rounded-lg h-24"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddProduct}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium"
                >
                  List Product
                </button>
                <button
                  onClick={() => setShowAddProduct(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
