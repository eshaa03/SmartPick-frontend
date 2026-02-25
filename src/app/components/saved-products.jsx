import { useEffect, useMemo, useState } from 'react';
import { BookmarkX } from 'lucide-react';
import { ProductCard } from './product-card';
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

const normalizeProduct = (item) => {
  if (!item) return null;
  if (item.product) return item.product;
  return {
    _id: item.id || item._id,
    title: item.title || item.name || "Saved product",
    image: item.image,
    price: item.price,
    originalPrice: item.originalPrice,
    platform: item.platform || "",
    rating: item.rating || 0,
    reviews: item.reviews || 0,
    aiScore: item.aiScore || 0,
    aiReason: item.aiReason || "Saved product",
    features: item.features || [],
    currencySymbol: item.currencySymbol || "₹",
  };
};

export function SavedProducts() {
  const [savedItems, setSavedItems] = useState([]);

  const products = useMemo(
    () => savedItems.map((item) => normalizeProduct(item)).filter(Boolean),
    [savedItems]
  );

  useEffect(() => {
    const load = () => setSavedItems(readSavedList());
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

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Saved Products</h2>
          <p className="text-slate-400">Your favorite picks in one place</p>
        </div>
        <div className="text-sm text-slate-400">
          {products.length} item{products.length === 1 ? '' : 's'}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="glass-strong rounded-2xl p-10 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center">
            <BookmarkX className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-100">No saved products yet</h3>
          <p className="text-slate-400 mt-2">
            Tap the heart icon on a product to save it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, i) => (
            <ProductCard
              key={product._id || product.id || `${product.title}-${i}`}
              product={product}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
