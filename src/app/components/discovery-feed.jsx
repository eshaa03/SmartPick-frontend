import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Flame,
  Sparkles,
  ChevronRight,
  Package,
  Laptop,
  Shirt,
  Home,
  Dumbbell,
} from 'lucide-react';
import { ProductCard } from './product-card';
import { getRecommendations } from '../../api/recommendations';

const TRENDING_PREVIEW_COUNT = 3;
const RECOMMENDED_PREVIEW_COUNT = 3;
const DISCOVERY_REFRESH_MS = 45000;

const TRENDING_QUERIES = [
  'wireless earbuds',
  'women tops',
  'running shoes',
  'smart watch',
];

const RECOMMENDED_QUERIES = [
  'best selling fashion',
  'home essentials',
  'smartphone deals',
  'bags for women',
];

const TRENDING_FALLBACK_QUERIES = [
  'wireless bluetooth earbuds',
  'women floral top',
  'men running shoes',
  'smart watch for men',
];

const RECOMMENDED_FALLBACK_QUERIES = [
  'women sling bag',
  'kitchen storage containers',
  'latest smartphone',
  'casual shirts for women',
];

const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.recommendations)) return value.recommendations;
  if (value && typeof value === 'object') return [value];
  return [];
};

const inferCategory = (product, fallback = '') => {
  const hay = normalizeText([
    product?.category,
    product?.title,
    product?.platform,
    ...(Array.isArray(product?.features) ? product.features : []),
  ].join(' '));

  if (hay.includes('phone') || hay.includes('laptop') || hay.includes('headphone') || hay.includes('watch')) return 'Electronics';
  if (hay.includes('shirt') || hay.includes('top') || hay.includes('dress') || hay.includes('shoe') || hay.includes('bag')) return 'Fashion';
  if (hay.includes('kitchen') || hay.includes('home') || hay.includes('appliance') || hay.includes('lamp')) return 'Home & Kitchen';
  if (hay.includes('fitness') || hay.includes('sports') || hay.includes('gym') || hay.includes('yoga')) return 'Sports';
  return fallback || 'General';
};

const normalizeForDiscovery = (entry, fallbackCategory = '') => {
  const source = entry?.product && typeof entry.product === 'object' ? entry.product : entry || {};
  const price = toNumber(source.price ?? source.current_price ?? source.sale_price ?? source.offer_price);
  const originalPrice = toNumber(
    source.originalPrice ?? source.original_price ?? source.mrp ?? source.list_price ?? source.strike_price
  );
  const normalizedOriginalPrice = originalPrice > price ? originalPrice : 0;
  const rating = Number(source.rating ?? source.stars ?? source.review_rating ?? source.average_rating ?? 0) || 0;
  const reviews = toNumber(source.reviews ?? source.review_count ?? source.ratings_total ?? source.rating_count);
  const rawScore = Number(source.aiScore ?? source.score ?? 0) || 0;
  const score =
    rawScore > 0
      ? Math.min(99, Math.max(50, Math.round(rawScore)))
      : Math.min(95, 68 + Math.round(rating * 6) + (reviews > 0 ? 4 : 0));

  return {
    ...source,
    id: source.id || source._id || `${source.title || 'product'}-${source.platform || 'store'}-${price}`,
    title: String(source.title || source.name || 'Product').trim(),
    image: String(source.image || source.image_url || source.thumbnail || '').trim(),
    price,
    originalPrice: normalizedOriginalPrice,
    platform: String(source.platform || source.source || source.store || 'SmartPick').trim(),
    rating: Math.max(0, Math.min(5, rating)),
    reviews,
    aiScore: score,
    aiReason: String(source.aiReason || source.reason || 'Popular choice based on relevance and ratings.').trim(),
    features: Array.isArray(source.features) ? source.features : [],
    currencySymbol: source.currencySymbol || source.currency_symbol || 'INR',
    category: inferCategory(source, fallbackCategory),
    url: source.url || source.link || source.product_url || source.productUrl || '',
  };
};

const isUsefulDiscoveryProduct = (product, query = '') => {
  const title = normalizeText(product?.title || '');
  const normalizedQuery = normalizeText(query);
  const platform = normalizeText(product?.platform || '');
  const hasImage = Boolean(String(product?.image || '').trim());
  const hasUrl = Boolean(String(product?.url || '').trim());
  const hasPrice = toNumber(product?.price) > 0;
  const hasStrongCommerceSignal = hasImage || hasUrl || hasPrice;
  const hasNonPlaceholderPlatform = Boolean(platform) && !['smartpick', 'unknown', ''].includes(platform);
  const hasCommerceSignal = hasStrongCommerceSignal || hasNonPlaceholderPlatform;
  const hasReasonableTitle = title.length >= 4 && !['product', 'item', 'unknown product'].includes(title);
  const queryEcho = Boolean(normalizedQuery) && title === normalizedQuery;
  if (!(hasCommerceSignal || hasReasonableTitle)) return false;
  // Keep query-echo items when they still carry a real commerce signal (url/image/price).
  if (queryEcho && !hasStrongCommerceSignal) return false;
  return true;
};

const mergeUniqueProducts = (groups = [], fallbackCategory = '') => {
  const out = [];
  const seen = new Set();

  for (const group of groups) {
    const groupQuery = String(group?.query || '').trim();
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      const normalized = normalizeForDiscovery(item, fallbackCategory);
      if (!isUsefulDiscoveryProduct(normalized, groupQuery)) continue;
      const key = normalizeText([
        normalized.title,
        normalized.platform,
        normalized.price,
        normalized.url,
      ].join('|'));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }

  return out;
};

const fetchDiscoveryProducts = async (
  queries = [],
  fallbackCategory = '',
  fallbackQueries = []
) => {
  const attempt = async (queryList) => {
    const settled = await Promise.allSettled(queryList.map((query) => getRecommendations(query)));
    const groups = settled
      .map((item, index) => ({ item, query: queryList[index] }))
      .filter(({ item }) => item.status === 'fulfilled')
      .map(({ item, query }) => ({
        query,
        items: toArray(item.value),
      }))
      .filter(({ items }) => items.length > 0);

    return mergeUniqueProducts(groups, fallbackCategory);
  };

  const primary = await attempt(queries);
  if (primary.length > 0) return primary;
  if (!fallbackQueries.length) return primary;
  return attempt(fallbackQueries);
};

export function DiscoveryFeed({
  trendingProducts = [],
  recommendedProducts = [],
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localTrending, setLocalTrending] = useState([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [localRecommended, setLocalRecommended] = useState([]);
  const [isRecommendedLoading, setIsRecommendedLoading] = useState(false);
  const hasSeededTrending = useRef(false);
  const hasSeededRecommended = useRef(false);
  const selectedCategory = searchParams.get('category') || '';
  const [showAllTrending, setShowAllTrending] = useState(false);
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const loadTrending = useCallback(async () => {
    setIsTrendingLoading(true);
    try {
      const products = await fetchDiscoveryProducts(
        TRENDING_QUERIES,
        'General',
        TRENDING_FALLBACK_QUERIES
      );
      setLocalTrending(products);
    } catch (err) {
      console.error('Failed to load trending products:', err);
      setLocalTrending([]);
    } finally {
      setIsTrendingLoading(false);
      hasSeededTrending.current = true;
      setLastUpdatedAt(new Date());
    }
  }, []);

  const loadRecommended = useCallback(async () => {
    setIsRecommendedLoading(true);
    try {
      const products = await fetchDiscoveryProducts(
        RECOMMENDED_QUERIES,
        'General',
        RECOMMENDED_FALLBACK_QUERIES
      );
      setLocalRecommended(products);
    } catch (err) {
      console.error('Failed to load recommended products:', err);
      setLocalRecommended([]);
    } finally {
      setIsRecommendedLoading(false);
      hasSeededRecommended.current = true;
      setLastUpdatedAt(new Date());
    }
  }, []);

  const refreshDiscovery = useCallback(async () => {
    await Promise.all([loadTrending(), loadRecommended()]);
    setLastUpdatedAt(new Date());
  }, [loadTrending, loadRecommended]);

  useEffect(() => {
    if (trendingProducts.length > 0) {
      setLocalTrending(trendingProducts.map((item) => normalizeForDiscovery(item, 'General')));
      setIsTrendingLoading(false);
      hasSeededTrending.current = true;
      return;
    }

    if (hasSeededTrending.current) return;
    loadTrending();
  }, [trendingProducts.length, loadTrending]);

  useEffect(() => {
    if (recommendedProducts.length > 0) {
      setLocalRecommended(recommendedProducts.map((item) => normalizeForDiscovery(item, 'General')));
      setIsRecommendedLoading(false);
      hasSeededRecommended.current = true;
      return;
    }

    if (hasSeededRecommended.current) return;
    loadRecommended();
  }, [recommendedProducts.length, loadRecommended]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshDiscovery();
      }
    }, DISCOVERY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshDiscovery]);

  const hasTrending = localTrending.length > 0;
  const hasRecommended = localRecommended.length > 0;

  const combinedProducts = useMemo(
    () => [...localTrending, ...localRecommended],
    [localTrending, localRecommended]
  );

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    const target = selectedCategory.toLowerCase();
    return combinedProducts.filter((product) =>
      String(product.category || '').toLowerCase().includes(target)
    );
  }, [combinedProducts, selectedCategory]);

  const trendingToShow = useMemo(() => {
    if (showAllTrending) return localTrending;
    return localTrending.slice(0, TRENDING_PREVIEW_COUNT);
  }, [localTrending, showAllTrending]);

  const recommendedToShow = useMemo(() => {
    if (showAllRecommended) return localRecommended;
    return localRecommended.slice(0, RECOMMENDED_PREVIEW_COUNT);
  }, [localRecommended, showAllRecommended]);

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-6 space-y-16 pb-28">
      <section id="trending">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-slate-100">Trending Now</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                <span>What others are loving</span>
                {lastUpdatedAt && (
                  <span className="text-[11px] text-slate-500">
                    Updated {lastUpdatedAt.toLocaleTimeString()}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-300 dark:border-teal-400/40 dark:bg-teal-500/12 dark:text-teal-200">
                  <Sparkles className="h-3 w-3 text-teal-300 dark:text-teal-200" />
                  AI curated
                </span>
              </div>
            </div>
          </div>

          {hasTrending && (
            <button
              onClick={() => setShowAllTrending((prev) => !prev)}
              className="self-end sm:self-auto inline-flex items-center gap-2 text-sm sm:text-base text-teal-600 hover:text-teal-500 dark:text-teal-300 dark:hover:text-teal-200 transition-colors"
            >
              <span>{showAllTrending ? 'Show less' : 'See all'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[180px]">
          {isTrendingLoading ? (
            <TrendingSkeleton />
          ) : hasTrending ? (
            trendingToShow.map((product, index) => (
              <ProductCard
                key={`trending-${product.id || product.title || 'item'}-${index}`}
                product={product}
                index={index}
              />
            ))
          ) : (
            <EmptyState
              title="No trending products yet"
              subtitle="We could not load trending products right now"
            />
          )}
        </div>
      </section>

      <section id="recommended">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-300 dark:text-teal-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-slate-100">Picked for You</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                <span>Personalized recommendations</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-300 dark:border-teal-400/40 dark:bg-teal-500/12 dark:text-teal-200">
                  <Sparkles className="h-3 w-3 text-teal-300 dark:text-teal-200" />
                  AI personalized
                </span>
              </div>
            </div>
          </div>

          {hasRecommended && (
            <button
              onClick={() => setShowAllRecommended((prev) => !prev)}
              className="self-end sm:self-auto inline-flex items-center gap-2 text-sm sm:text-base text-teal-600 hover:text-teal-500 dark:text-teal-300 dark:hover:text-teal-200 transition-colors"
            >
              <span>{showAllRecommended ? 'Show less' : 'See all'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[180px]">
          {isRecommendedLoading ? (
            <TrendingSkeleton />
          ) : hasRecommended ? (
            recommendedToShow.map((product, index) => (
              <ProductCard
                key={`recommended-${product.id || product.title || 'item'}-${index}`}
                product={product}
                index={index}
              />
            ))
          ) : (
            <EmptyState
              title="No recommendations yet"
              subtitle="Try again in a moment to load recommendations"
            />
          )}
        </div>
      </section>

      <section className="discovery-categories">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-teal-300 dark:text-teal-200" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Explore Categories</h2>
            <p className="text-sm text-slate-400">Discover products instantly</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Electronics', icon: Laptop },
            { name: 'Fashion', icon: Shirt },
            { name: 'Home & Kitchen', icon: Home },
            { name: 'Sports', icon: Dumbbell },
          ].map((category, index) => (
            <motion.button
              key={category.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('category', category.name);
                  return next;
                });
              }}
              className={`glass-strong rounded-2xl p-6 flex flex-col items-center gap-3 transition-all ${
                selectedCategory === category.name
                  ? 'ring-1 ring-teal-500/60 bg-teal-500/12 dark:ring-teal-400/55 dark:bg-teal-500/12'
                  : 'hover:bg-slate-800/40'
              }`}
            >
              <category.icon className="w-8 h-8 text-teal-500 dark:text-teal-300" />
              <span className="text-slate-100 font-medium">{category.name}</span>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="discovery-category-picks">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Package className="w-5 h-5 text-teal-300 dark:text-teal-200" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">
                {selectedCategory ? `${selectedCategory} Picks` : 'Category Picks'}
              </h2>
              <p className="text-sm text-slate-400">
                {selectedCategory ? 'Filtered by your selection' : 'Choose a category to see products'}
              </p>
            </div>
          </div>

          {selectedCategory && (
            <button
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('category');
                  return next;
                });
              }}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[180px]">
          {selectedCategory ? (
            filteredProducts.length > 0 ? (
              filteredProducts.map((product, index) => (
                <ProductCard
                  key={`cat-${product.id || product._id || index}`}
                  product={product}
                  index={index}
                />
              ))
            ) : (
              <EmptyState
                title="No products in this category"
                subtitle="Try a different category or check back soon"
              />
            )
          ) : (
            <EmptyState
              title="Choose a category above"
              subtitle="We'll show matching products here"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-800/30 py-12 text-center"
    >
      <Sparkles className="w-6 h-6 text-teal-500 dark:text-teal-300 mb-3" />
      <p className="text-slate-200 font-medium">{title}</p>
      <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
    </motion.div>
  );
}

function TrendingSkeleton() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="glass-strong rounded-3xl p-4 animate-pulse"
        >
          <div className="h-4 w-1/3 bg-slate-700/60 rounded-full mb-4" />
          <div className="aspect-[16/9] w-full rounded-2xl bg-slate-800/60 mb-4" />
          <div className="h-4 w-3/4 bg-slate-700/60 rounded-full mb-2" />
          <div className="h-4 w-1/2 bg-slate-700/60 rounded-full mb-4" />
          <div className="h-8 w-full bg-slate-800/60 rounded-xl" />
        </div>
      ))}
    </>
  );
}
