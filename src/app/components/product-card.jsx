import { motion } from 'motion/react';
import { Star, ExternalLink, TrendingUp, ShoppingCart, Heart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { scopedStorageKey } from '../lib/user-storage';

const SAVED_KEY = "savedProducts";
const UPDATE_EVENT = "saved-products-updated";

const getSavedKey = () => scopedStorageKey(SAVED_KEY);

const readSavedList = () => {
  try {
    return JSON.parse(localStorage.getItem(getSavedKey()) || "[]");
  } catch {
    return [];
  }
};

const getSavedId = (item) => item?.id || item?.product?.id || item?.product?._id;

const safeNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildProductUrl = (product) => {
  const directUrl = String(
    product?.url || product?.link || product?.product_url || product?.productUrl || ""
  ).trim();
  if (directUrl) return directUrl;

  const title = encodeURIComponent(String(product?.title || "").trim());
  const platform = String(product?.platform || "").toLowerCase();
  if (!title) return "";
  if (platform.includes("amazon")) return `https://www.amazon.in/s?k=${title}`;
  if (platform.includes("flipkart")) return `https://www.flipkart.com/search?q=${title}`;
  return `https://www.google.com/search?q=${title}`;
};

export function ProductCard({ product, index = 0 }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const safePrice = safeNumber(product.price);
  const safeOriginalPrice = safeNumber(product.originalPrice);
  const hasHigherMrp = safeOriginalPrice > safePrice && safePrice > 0;
  const hasOffer =
    Boolean(product.hasOffer) ||
    (Number(product.discountPercent) > 0) ||
    (safeOriginalPrice > safePrice && safePrice > 0);
  const discount = hasOffer
    ? Math.max(
        0,
        Number(product.discountPercent) ||
          (safeOriginalPrice > 0
            ? Math.round(((safeOriginalPrice - safePrice) / safeOriginalPrice) * 100)
            : 0)
      )
    : 0;
  const showImage = Boolean(product.image) && !imageError;
  const currencySymbol = (product.currencySymbol === "INR" || !product.currencySymbol)
    ? "\u20B9"
    : product.currencySymbol;
  const productUrl = buildProductUrl(product);
  const ratingValue = Number(product.rating) || 0;
  const reviewCount = safeNumber(product.reviews);

  const productId = useMemo(
    () =>
      product._id ||
      product.id ||
      product.asin ||
      product.productId ||
      product.pid ||
      `${product.title}-${product.platform}`,
    [product]
  );

  useEffect(() => {
    const syncSavedState = () => {
      const saved = readSavedList();
      setIsSaved(saved.some((item) => getSavedId(item) === productId));
    };

    syncSavedState();

    const handleStorage = (event) => {
      if (event?.key === getSavedKey()) syncSavedState();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(UPDATE_EVENT, syncSavedState);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(UPDATE_EVENT, syncSavedState);
    };
  }, [productId]);

  const handleToggleSave = () => {
    try {
      const saved = readSavedList();
      const exists = saved.some((item) => getSavedId(item) === productId);
      const next = exists
        ? saved.filter((item) => getSavedId(item) !== productId)
        : [
            ...saved,
            {
              id: productId,
              savedAt: new Date().toISOString(),
              product: {
                ...product,
                id: productId,
              },
            },
          ];
      localStorage.setItem(getSavedKey(), JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
      setIsSaved(!exists);
    } catch {
      setIsSaved(false);
    }
  };

  const openProductUrl = () => {
    if (!productUrl) return;
    window.open(productUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.19, 1.0, 0.22, 1.0],
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group h-full"
    >
      <motion.div
        className="glass-strong rounded-3xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10 h-full min-h-[40rem] flex flex-col"
        animate={{
          rotateX: isHovered ? 5 : 0,
          rotateY: isHovered ? 5 : 0,
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="flex items-center justify-between mb-4">
          <motion.div
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-500/20 to-sky-500/20 border border-teal-500/30 flex items-center gap-2"
            animate={{
              boxShadow: isHovered
                ? '0 0 20px rgba(20, 184, 166, 0.3)'
                : '0 0 0px rgba(20, 184, 166, 0)',
            }}
          >
            <TrendingUp className="w-3 h-3 text-teal-400" />
            <span className="text-sm font-medium text-teal-400">
              {product.aiScore}% Match
            </span>
          </motion.div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-slate-800/50 text-xs text-slate-400">
              {product.platform}
            </div>
            <motion.button
              type="button"
              aria-pressed={isSaved}
              onClick={handleToggleSave}
              className={`p-2 rounded-full transition-colors border ${
                isSaved
                  ? "bg-red-500/20 border-red-500/40 text-red-300"
                  : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-red-300 hover:border-red-500/40"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={isSaved ? "Remove from saved" : "Save product"}
            >
              <Heart className={`w-4 h-4 ${isSaved ? "fill-red-400" : ""}`} />
            </motion.button>
          </div>
        </div>

        <div className="relative mb-4 rounded-2xl overflow-hidden bg-slate-800/30 aspect-[16/9] flex items-center justify-center">
          {showImage ? (
            <img
              src={product.image}
              alt={product.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <ShoppingCart className="w-8 h-8" />
              <span className="text-xs">No image available</span>
            </div>
          )}
          {discount > 0 && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-medium">
              -{discount}%
            </div>
          )}
        </div>

        <h3 className="font-medium text-slate-100 mb-2 line-clamp-2 min-h-[3rem]">
          {product.title}
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(ratingValue)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-slate-600'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-slate-400">
            {ratingValue > 0 ? ratingValue.toFixed(1) : "N/A"} ({reviewCount.toLocaleString()})
          </span>
        </div>

        <div className="mb-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Current Price</div>
          <div className="text-2xl font-semibold text-slate-100">
            {safePrice > 0 ? `${currencySymbol}${safePrice.toLocaleString()}` : "Price unavailable"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            <span className="mr-1">M.R.P.:</span>
            {safeOriginalPrice > 0 ? (
              <span className={hasHigherMrp ? "line-through text-slate-500" : "text-slate-400"}>
                {currencySymbol}{safeOriginalPrice.toLocaleString()}
              </span>
            ) : (
              <span className="text-slate-500">N/A</span>
            )}
          </div>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 min-h-[4.5rem]">
          <p className="text-sm text-slate-300 leading-relaxed">
            <span className="text-teal-400 font-medium">
              Why SmartPick chose this:
            </span>{' '}
            <span className="block line-clamp-2">{product.aiReason}</span>
          </p>
        </div>

        <div className="mb-4 space-y-1">
          {(product.features || []).slice(0, 3).map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-1 h-1 rounded-full bg-teal-400" />
              <span className="line-clamp-1">{feature}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-auto">
          <motion.button
            type="button"
            onClick={openProductUrl}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-teal-500/30 transition-shadow disabled:opacity-60"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!productUrl}
          >
            <ShoppingCart className="w-4 h-4" />
            Buy on {product.platform}
          </motion.button>
          <motion.button
            type="button"
            onClick={openProductUrl}
            className="p-3 rounded-xl glass hover:bg-slate-700/50 transition-colors disabled:opacity-60"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!productUrl}
          >
            <ExternalLink className="w-5 h-5 text-slate-400" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}


