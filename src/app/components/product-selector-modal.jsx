import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Plus } from 'lucide-react';
import { useState } from 'react';

export function ProductSelectorModal({
  isOpen,
  onClose,
  onSelectProduct,
  chatProducts = [],
  savedProducts = [],
  selectedProducts,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [source, setSource] = useState('chat');

  const safeNumber = (value) => {
    const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const visibleProducts = source === 'saved' ? savedProducts : chatProducts;

  const filteredProducts = visibleProducts.filter(
    (product) =>
      !selectedProducts.find((p) => p.id === product.id) &&
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-strong rounded-3xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">
                    Select Product to Compare
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Choose products from chats or saved ({selectedProducts.length}/4 selected)
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-slate-700/50 transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Source Tabs */}
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSource('chat')}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    source === 'chat'
                      ? 'bg-teal-700/40 border-teal-400/40 text-teal-200'
                      : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  From Chats ({chatProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSource('saved')}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    source === 'saved'
                      ? 'bg-teal-700/40 border-teal-400/40 text-teal-200'
                      : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  From Saved ({savedProducts.length})
                </button>
              </div>

              {/* Search */}
              <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-12 pr-4 py-3 rounded-xl glass border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass rounded-2xl p-4 hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex gap-4">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-24 h-24 object-contain rounded-xl bg-slate-800/30"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-100 mb-2 line-clamp-2">
                            {product.name}
                          </h3>
                          <div className="text-lg font-semibold text-blue-400 mb-3">
                            {'\u20B9'}{safeNumber(product.price).toLocaleString()}
                          </div>
                          <button
                            onClick={() => {
                              onSelectProduct(product);
                              onClose();
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow"
                          >
                            <Plus className="w-4 h-4" />
                            Add to Compare
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-400">
                      {visibleProducts.length === 0
                        ? `No ${source === 'saved' ? 'saved' : 'chat'} products available`
                        : 'No products found'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
