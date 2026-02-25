import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { TrendingUp, Target, Award, Activity } from 'lucide-react';
import { scopedStorageKey } from '../lib/user-storage';

const SAVED_KEY = "savedProducts";
const CHAT_KEY = "chatSessions";
const UPDATE_EVENT = "saved-products-updated";
const getSavedKey = () => scopedStorageKey(SAVED_KEY);
const getChatKey = () => scopedStorageKey(CHAT_KEY);

const COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];
const TOOLTIP_STYLE = {
  backgroundColor: '#0b1220',
  border: '1px solid rgba(45, 212, 191, 0.25)',
  borderRadius: '12px',
  color: '#e2e8f0',
};

const TOOLTIP_LABEL_STYLE = { color: '#cbd5e1' };
const TOOLTIP_ITEM_STYLE = { color: '#f8fafc' };

export function AnalyticsDashboard() {
  const [savedProducts, setSavedProducts] = useState([]);
  const [chatProducts, setChatProducts] = useState([]);
  useEffect(() => {
    const readSaved = () => {
      try {
        return JSON.parse(localStorage.getItem(getSavedKey()) || "[]");
      } catch {
        return [];
      }
    };

    const readChatProducts = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(getChatKey()) || "null");
        const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
        return sessions.flatMap((session) => {
          const products = Array.isArray(session?.recommendedProducts)
            ? session.recommendedProducts
            : [];
          return products.map((product) => ({
            ...product,
            savedAt: session?.updatedAt || product?.savedAt || null,
          }));
        });
      } catch {
        return [];
      }
    };

    const load = () => {
      setSavedProducts(readSaved());
      setChatProducts(readChatProducts());
    };
    load();

    const handleStorage = (event) => {
      if (event?.key === getSavedKey()) load();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(UPDATE_EVENT, load);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(UPDATE_EVENT, load);
    };
  }, []);

  const normalized = useMemo(
    () =>
      [...savedProducts, ...chatProducts]
        .map((item) => ({
          raw: item?.product ?? item,
          savedAt: item?.savedAt || item?.saved_at || item?.product?.savedAt || item?.product?.saved_at || null,
        }))
        .filter((entry) => Boolean(entry.raw))
        .filter(Boolean)
        .map(({ raw, savedAt }) => ({
          id: raw.id || raw._id || `${raw.title || "product"}-${raw.platform || "store"}`,
          category: raw.category || raw.platform || 'Other',
          aiScore: Math.max(0, Math.min(100, Number(raw.aiScore) || 0)),
          savedAt,
        })),
    [savedProducts, chatProducts]
  );

  const preferenceData = useMemo(() => {
    const counts = new Map();
    normalized.forEach((product) => {
      const key = String(product.category || 'Other');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const items = Array.from(counts.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
    return items.length > 0
      ? items
      : [{ category: 'No data', value: 1 }];
  }, [normalized]);

  const accuracyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: date.toLocaleString('en-US', { month: 'short' }),
        scores: [],
      };
    });

    normalized.forEach((product) => {
      if (!product.savedAt) return;
      const date = new Date(product.savedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.scores.push(product.aiScore);
    });

    return months.map((bucket) => ({
      month: bucket.month,
      accuracy: bucket.scores.length
        ? Math.round(
            bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length
          )
        : 0,
    }));
  }, [normalized]);

  const confidenceData = useMemo(() => {
    const buckets = [
      { range: '90-100%', count: 0, min: 90, max: 100 },
      { range: '80-90%', count: 0, min: 80, max: 89.999 },
      { range: '70-80%', count: 0, min: 70, max: 79.999 },
      { range: '60-70%', count: 0, min: 60, max: 69.999 },
      { range: '<60%', count: 0, min: -Infinity, max: 59.999 },
    ];

    normalized.forEach((product) => {
      const score = product.aiScore || 0;
      const bucket = buckets.find((b) => score >= b.min && score <= b.max);
      if (bucket) bucket.count += 1;
    });

    return buckets.map(({ range, count }) => ({ range, count }));
  }, [normalized]);

  const stats = useMemo(() => {
    const total = normalized.length;
    const avgAccuracy = total
      ? Math.round(
          normalized.reduce((sum, item) => sum + (item.aiScore || 0), 0) / total
        )
      : 0;
    const topMatches = normalized.filter((item) => item.aiScore >= 85).length;
    const today = new Date();
    const queriesToday = normalized.filter((item) => {
      if (!item.savedAt) return false;
      const date = new Date(item.savedAt);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    }).length;

    return {
      total,
      avgAccuracy,
      topMatches,
      queriesToday,
    };
  }, [normalized]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-6 pb-28 md:pb-8 analytics-dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, label: 'Recommendations', value: stats.total.toLocaleString(), change: 'Live', color: 'from-teal-500 to-sky-500' },
          { icon: Target, label: 'Avg. Accuracy', value: `${stats.avgAccuracy}%`, change: 'Live', color: 'from-cyan-500 to-sky-500' },
          { icon: Award, label: 'Top Matches', value: stats.topMatches.toLocaleString(), change: 'Live', color: 'from-emerald-500 to-teal-500' },
          { icon: Activity, label: 'Queries Today', value: stats.queriesToday.toLocaleString(), change: 'Live', color: 'from-sky-500 to-cyan-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-strong rounded-2xl p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center glow-blue-subtle`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-teal-400 text-sm font-medium">{stat.change}</span>
            </div>
            <div className="text-3xl font-semibold text-slate-100 mb-1">{stat.value}</div>
            <div className="text-sm text-slate-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Preferences */}
        <motion.div className="glass-strong rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Category Preferences</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={preferenceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {preferenceData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Accuracy Trend */}
        <motion.div className="glass-strong rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Accuracy Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={accuracyData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.25)" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[0, 100]} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#14b8a6"
                strokeWidth={3}
                dot={{ r: 4, stroke: '#0d9488', strokeWidth: 2, fill: '#99f6e4' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Confidence Scores */}
        <motion.div className="glass-strong rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">AI Confidence Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confidenceData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.2)" />
              <XAxis dataKey="range" stroke="#64748b" />
              <YAxis stroke="#64748b" allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(15, 23, 42, 0.6)' }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
              />
              <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="count" position="top" fill="#99f6e4" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
