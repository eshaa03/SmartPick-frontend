import { motion } from 'motion/react';
import { Home, Compass, GitCompare, BarChart3, User, Heart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: '/', icon: Home, label: 'Home' },
    { id: '/discover', icon: Compass, label: 'Discover' },
    { id: '/compare', icon: GitCompare, label: 'Compare' },
    { id: '/analytics', icon: BarChart3, label: 'Analytics' },
    { id: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
    >
      <div className="glass-strong border-t border-slate-700/50 px-2 py-3">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname === item.id;

            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.id)}
                className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-teal-200/85 dark:bg-teal-500/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon
                  className={`w-5 h-5 relative z-10 ${
                    isActive ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                <span
                  className={`text-xs relative z-10 ${
                    isActive ? 'text-teal-700 dark:text-teal-300 font-medium' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
