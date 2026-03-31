import React, { createContext, useContext, useEffect, useState } from 'react';
import { useFirebase } from './FirebaseProvider';
import { bankService } from '../services/bankService';

interface MarketAsset {
  id: string;
  name: string;
  price: number;
  change: number;
}

interface EconomyContextType {
  billingCountdown: number;
  economyStats: {
    totalUsers: number;
    totalCirculation: number;
    averageBalance: number;
  };
  marketData: MarketAsset[];
}

const EconomyContext = createContext<EconomyContextType>({
  billingCountdown: 300,
  economyStats: {
    totalUsers: 0,
    totalCirculation: 0,
    averageBalance: 0,
  },
  marketData: [],
});

export const useEconomy = () => useContext(EconomyContext);

export const EconomyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useFirebase();
  const [billingCountdown, setBillingCountdown] = useState(() => {
    const saved = localStorage.getItem('paybank_billing_countdown');
    return saved ? parseInt(saved, 10) : 300;
  });

  useEffect(() => {
    localStorage.setItem('paybank_billing_countdown', billingCountdown.toString());
  }, [billingCountdown]);

  const [economyStats, setEconomyStats] = useState({
    totalUsers: 1240, // Simulated stats
    totalCirculation: 15420000,
    averageBalance: 12435,
  });
  const [marketData, setMarketData] = useState<MarketAsset[]>(() => {
    const saved = localStorage.getItem('paybank_market_data');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'pbk', name: 'PayBank Stock', price: 145.20, change: 2.4 },
      { id: 'fcoin', name: 'FakeCoin', price: 42069, change: -5.2 },
      { id: 'gold', name: 'SimGold', price: 5420, change: 0.8 },
      { id: 'nifty', name: 'Simulated Nifty', price: 21500, change: -0.5 },
      { id: 'tech', name: 'Tech Index', price: 4500, change: 3.1 },
      { id: 'energy', name: 'Energy Fund', price: 1800, change: -1.8 },
    ];
  });

  useEffect(() => {
    localStorage.setItem('paybank_market_data', JSON.stringify(marketData));
  }, [marketData]);

  // Global Billing Timer - persists across navigation
  useEffect(() => {
    const interval = setInterval(() => {
      if (profile?.isGamePaused) {
        if (profile.gamePauseEndTime !== -1 && Date.now() > profile.gamePauseEndTime) {
          bankService.resumeGame();
        }
        return;
      }
      
      setBillingCountdown(prev => {
        if (prev <= 1) {
          if (profile) {
            bankService.runBilling();
          }
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [profile]);

  // Periodically update simulated economy stats and market data
  useEffect(() => {
    const interval = setInterval(() => {
      if (profile?.isGamePaused) {
        return;
      }

      setEconomyStats(prev => ({
        ...prev,
        totalCirculation: prev.totalCirculation + Math.floor(Math.random() * 50000),
        averageBalance: Math.floor((prev.totalCirculation + 50000) / prev.totalUsers),
      }));

      setMarketData(prev => prev.map(asset => {
        const volatility = asset.id === 'fcoin' ? 0.15 : 0.08; // High volatility for crypto, moderate for others
        const changePercent = (Math.random() - 0.5) * volatility; 
        const newPrice = asset.price * (1 + changePercent);
        return {
          ...asset,
          price: parseFloat(newPrice.toFixed(2)),
          change: parseFloat((changePercent * 100).toFixed(2)),
        };
      }));
    }, 5000); // Update every 5 seconds for more "power"

    return () => clearInterval(interval);
  }, [profile]);

  return (
    <EconomyContext.Provider value={{ billingCountdown, economyStats, marketData }}>
      {children}
    </EconomyContext.Provider>
  );
};
