import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';
import { useFirebase } from './FirebaseProvider';
import { cn } from '../lib/utils';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  title?: string;
  description?: string;
}

export const PinModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Enter PIN", 
  description = "Please enter your 4-digit transaction PIN to continue." 
}: PinModalProps) => {
  const [pin, setPin] = useState('');
  const { profile } = useFirebase();
  const isPremiumUI = profile?.uiSubscriptionEnd && profile.uiSubscriptionEnd > Date.now();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      onConfirm(pin);
      setPin('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "relative w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-hidden",
              isPremiumUI ? "bg-gray-900 border border-white/10" : "bg-white"
            )}
          >
            <div className="text-center mb-8">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                isPremiumUI ? "bg-white/5 text-white" : "bg-blue-50 text-blue-600"
              )}>
                <Lock className="w-8 h-8" />
              </div>
              <h3 className={cn("text-2xl font-bold mb-2", isPremiumUI ? "text-white" : "text-gray-900")}>{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <input 
                type="password"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className={cn(
                  "w-full p-4 rounded-2xl text-center text-4xl font-mono tracking-[1em] focus:ring-2 focus:ring-blue-600 outline-none transition-all",
                  isPremiumUI ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
                )}
              />
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all",
                    isPremiumUI ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={pin.length !== 4}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all shadow-lg disabled:opacity-50",
                    isPremiumUI ? "bg-white text-black hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  Confirm
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
