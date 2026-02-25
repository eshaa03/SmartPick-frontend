import { motion } from 'motion/react';
import { Star, Check, X, Trophy, Plus, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductSelectorModal } from './product-selector-modal';
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

const safeNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildProductUrl = (product) => {
  const directUrl = String(
    product?.url || product?.link || product?.product_url || product?.productUrl || ""
  ).trim();
  if (directUrl) return directUrl;

  const title = encodeURIComponent(String(product?.name || product?.title || "").trim());
  const platform = String(product?.platform || "").toLowerCase();
  if (!title) return "";
  if (platform.includes("amazon")) return `https://www.amazon.in/s?k=${title}`;
  if (platform.includes("flipkart")) return `https://www.flipkart.com/search?q=${title}`;
  if (platform.includes("myntra")) return `https://www.myntra.com/${title}`;
  return `https://www.google.com/search?q=${title}`;
};

export function ComparisonView({ products: initialProducts, allProducts }) {
  const [savedProducts, setSavedProducts] = useState([]);
  const normalizedSavedProducts = useMemo(
    () => savedProducts.map((product, index) => normalizeProduct(product, index)).filter(Boolean),
    [savedProducts]
  );
  const normalizedChatProducts = useMemo(
    () => ((allProducts && allProducts.length > 0 ? allProducts : []))
      .map((product, index) => normalizeProduct(product, index))
      .filter(Boolean),
    [allProducts]
  );
  const normalizedAllProducts = useMemo(() => {
    const merged = [...normalizedChatProducts, ...normalizedSavedProducts];
    const seen = new Set();
    const out = [];
    for (const product of merged) {
      const key = String(product?.id || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(product);
    }
    return out;
  }, [normalizedChatProducts, normalizedSavedProducts]);

  const normalizedInitialProducts = useMemo(() => {
    if (initialProducts && initialProducts.length > 0) {
      return initialProducts.map((product, index) => normalizeProduct(product, index));
    }
    return [];
  }, [initialProducts]);

  const [selectedProducts, setSelectedProducts] = useState(() =>
    (normalizedInitialProducts.length > 0 ? normalizedInitialProducts : normalizedAllProducts).slice(0, 3)
  );
  const [failedImages, setFailedImages] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasSeededSelection = useRef(false);

  useEffect(() => {
    if (hasSeededSelection.current) return;
    if (selectedProducts.length > 0) {
      hasSeededSelection.current = true;
      return;
    }
    if (normalizedAllProducts.length > 0) {
      setSelectedProducts(normalizedAllProducts.slice(0, 3));
      hasSeededSelection.current = true;
    }
  }, [normalizedAllProducts, selectedProducts.length]);

  useEffect(() => {
    const load = () => setSavedProducts(readSavedList());
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

  const handleRemoveProduct = (id) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddProduct = (product) => {
    setSelectedProducts((prev) => {
      if (prev.length >= 4) return prev;
      if (prev.some((item) => item.id === product.id)) return prev;
      return [...prev, product];
    });
  };

  const bestProduct =
    selectedProducts.length > 0
      ? selectedProducts.reduce((prev, current) =>
          prev.aiScore > current.aiScore ? prev : current
        )
      : null;
  const canAddMore = selectedProducts.length < 4;
  const handleChooseProduct = (product) => {
    const url = buildProductUrl(product);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const totalCards = selectedProducts.length + (canAddMore ? 1 : 0);
  const gridClass =
    totalCards <= 1
      ? 'max-w-md mx-auto'
      : totalCards === 2
      ? 'md:grid-cols-2'
      : totalCards === 3
      ? 'md:grid-cols-2 lg:grid-cols-3'
      : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="space-y-6 pt-10 px-4 sm:px-6 lg:px-8 pb-28 md:pb-8 comparison-view">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-2xl p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100 mb-2">Product Comparison</h2>
            <p className="text-slate-400">Compare features, prices, and AI scores side by side</p>
          </div>
          {canAddMore && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-teal-700/70 border border-teal-400/25 text-white font-medium flex items-center gap-2 hover:bg-teal-700/80 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Product
            </button>
          )}
        </div>
      </motion.div>

      {selectedProducts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
            <Plus className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-100 mb-2">No Products Selected</h3>
          <p className="text-slate-400 mb-6">Add products to start comparing</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-xl bg-teal-700/70 border border-teal-400/25 text-white font-medium inline-flex items-center gap-2 hover:bg-teal-700/80 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Product
          </button>
        </motion.div>
      ) : (
        <>
          {/* AI Summary */}
          {bestProduct && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-strong rounded-2xl p-6 border-2 border-teal-500/30 glow-blue-subtle"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">AI Recommendation</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Based on your requirements,{' '}
                    <span className="text-teal-400 font-medium">{bestProduct.name}</span> is
                    the best match with a {bestProduct.aiScore}% confidence score. It offers the
                    best value for money and matches your needs most closely.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Comparison Grid */}
          <div className={`grid grid-cols-1 gap-5 ${gridClass} pb-6`}>
            {selectedProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={`glass-strong rounded-2xl p-5 lg:p-6 relative ${
                  bestProduct && product.id === bestProduct.id
                    ? 'ring-2 ring-teal-500 glow-blue-subtle'
                    : ''
                }`}
              >
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveProduct(product.id)}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Product Image */}
                <div className="relative mb-4 rounded-2xl overflow-hidden bg-slate-800/30 aspect-[4/3]">
                  {bestProduct && product.id === bestProduct.id && (
                    <div className="absolute top-2 left-3 z-20 px-3 py-1.5 rounded-full bg-slate-900/85 border border-yellow-400/55 shadow-md shadow-black/40 flex items-center gap-2 backdrop-blur-sm">
                      <Trophy className="w-4 h-4 text-yellow-300" />
                      <span className="text-xs font-medium text-yellow-200">Best Pick</span>
                    </div>
                  )}
                  {product.image && !failedImages[product.id] ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                      }
                      className="w-full h-full object-contain p-3"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                      <ShoppingCart className="w-8 h-8" />
                      <span className="text-xs">No image available</span>
                    </div>
                  )}
                </div>

                {/* Product Name */}
                <h3 className="font-semibold text-slate-100 mb-3 line-clamp-2 min-h-[2.5rem]">
                  {product.name}
                </h3>

                {/* AI Score */}
                <div className="mb-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center">
                  <div className="text-2xl font-bold text-teal-400 mb-1">
                    {product.aiScore}%
                  </div>
                  <div className="text-xs text-slate-400">AI Match Score</div>
                </div>

                {/* Price */}
                <div className="mb-4 p-3 rounded-xl bg-slate-800/50 text-center">
                  <div className="text-xl font-bold text-slate-100">
                    {"\u20B9"}{safeNumber(product.price).toLocaleString()}
                  </div>
                  {safeNumber(product.originalPrice) > safeNumber(product.price) && (
                    <div className="text-sm text-slate-500 line-through">
                      {"\u20B9"}{safeNumber(product.originalPrice).toLocaleString()}
                    </div>
                  )}
                  {safeNumber(product.originalPrice) > safeNumber(product.price) && (
                    <div className="text-xs text-emerald-300 mt-1">
                      {Math.round(
                        ((safeNumber(product.originalPrice) - safeNumber(product.price)) /
                          safeNumber(product.originalPrice)) *
                          100
                      )}% OFF
                    </div>
                  )}
                </div>

                {/* Rating */}
                <div className="mb-4 flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-slate-400">{product.rating}</span>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {product.features.slice(0, 3).map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Platform */}
                <div className="text-center text-sm text-slate-400 mb-4">
                  Available on {product.platform}
                </div>

                {/* CTA */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleChooseProduct(product)}
                  className={`w-full py-2.5 rounded-xl font-medium ${
                    bestProduct && product.id === bestProduct.id
                      ? 'bg-gradient-to-r from-teal-600 to-sky-600 text-white glow-blue-subtle'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  {bestProduct && product.id === bestProduct.id
                    ? 'Choose Best Pick'
                    : 'Select This'}
                </motion.button>
              </motion.div>
            ))}

            {/* Add Product Card */}
            {canAddMore && (
              <motion.button
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setIsModalOpen(true)}
                className="glass-strong rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] hover:bg-slate-700/15 transition-colors group"
              >
                <div className="w-20 h-20 rounded-full bg-slate-800/45 border border-slate-700/50 flex items-center justify-center mb-4 group-hover:bg-slate-800/55 transition-colors">
                  <Plus className="w-10 h-10 text-slate-400 group-hover:text-slate-300 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">
                  Add Product
                </h3>
                <p className="text-sm text-slate-500 mt-2">Compare up to 4 products</p>
              </motion.button>
            )}
          </div>

          {/* Feature Comparison Table */}
          {selectedProducts.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-strong rounded-2xl p-6 overflow-x-auto"
            >
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                Detailed Comparison
              </h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 text-slate-400 font-medium">
                      Feature
                    </th>
                    {selectedProducts.map((product) => (
                      <th
                        key={product.id}
                        className="text-center py-3 text-slate-400 font-medium"
                      >
                        Product {selectedProducts.indexOf(product) + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-3 text-slate-300">Price</td>
                    {selectedProducts.map((product) => (
                      <td
                        key={product.id}
                        className="text-center py-3 text-slate-100 font-medium"
                      >
                        {"\u20B9"}{safeNumber(product.price).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-3 text-slate-300">Rating</td>
                    {selectedProducts.map((product) => (
                      <td key={product.id} className="text-center py-3 text-slate-100">
                        {product.rating} / 5
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-3 text-slate-300">Reviews</td>
                    {selectedProducts.map((product) => (
                      <td key={product.id} className="text-center py-3 text-slate-100">
                        {product.reviews.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-3 text-slate-300">AI Score</td>
                    {selectedProducts.map((product) => (
                      <td key={product.id} className="text-center py-3">
                        <span className="text-teal-400 font-semibold">
                          {product.aiScore}%
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-3 text-slate-300">Platform</td>
                    {selectedProducts.map((product) => (
                      <td key={product.id} className="text-center py-3 text-slate-100">
                        {product.platform}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </motion.div>
          )}
        </>
      )}

      {/* Product Selector Modal */}
      <ProductSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectProduct={handleAddProduct}
        chatProducts={normalizedChatProducts}
        savedProducts={normalizedSavedProducts}
        selectedProducts={selectedProducts}
      />
    </div>
  );
}

const normalizeProduct = (product, index) => {
  if (!product) return null;
  const source = product.product || product;
  const id = source.id || source._id || source.productId || `product-${index}`;
  const name = source.name || source.title || 'Product';
  const image = source.image || source.thumbnail || '';
  const price = safeNumber(source.price);
  const originalPrice = safeNumber(source.originalPrice);
  const rating = Number(source.rating) || 0;
  const reviews = Number(source.reviews) || 0;
  const aiScore = Number(source.aiScore) || 0;
  const features = Array.isArray(source.features) ? source.features : [];
  const platform = source.platform || 'SmartPick';
  const url = source.url || source.link || source.product_url || source.productUrl || '';

  return {
    id,
    name,
    image,
    price,
    originalPrice,
    rating,
    reviews,
    aiScore,
    features,
    platform,
    url,
  };
};


