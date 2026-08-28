// ============================================
// Search Overlay Component
// ============================================

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores';
import { productsApi } from '../../api';
import { formatPrice, getProductImage, debounce } from '../../utils';
import type { Product } from '../../types';

const trendingSearches = [
  'LED Headlights',
  'Dash Cam',
  'Car Stereo',
  'Jump Starter',
  'Work Lights',
  'Phone Mount',
];

const recentSearches = ['wireless charger', 'led strip lights', 'obd2 scanner'];

export default function SearchOverlay() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { closeSearch, searchQuery, setSearchQuery } = useUIStore();
  
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeSearch]);

  // Search products with debounce
  useEffect(() => {
    const search = debounce(async (query: string) => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const products = await productsApi.search(query, 6);
        setResults(products);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    search(searchQuery);
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      closeSearch();
      // ProductsPage reads the `search` query param, not `q` -- this
      // previously sent shoppers to /search?q=... where ProductsPage
      // silently ignored it and showed the unfiltered catalog instead.
      navigate(`/search?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleQuickSearch = (query: string) => {
    closeSearch();
    navigate(`/search?search=${encodeURIComponent(query)}`);
  };

  return (
    <div className="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white animate-slide-down">
        <div className="container mx-auto px-4 py-6">
          {/* Search Input */}
          <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products, brands, categories..."
              className="w-full pl-14 pr-14 py-4 text-lg bg-gray-100 border-2 border-transparent rounded-2xl focus:bg-white focus:border-orange-500 focus:outline-none transition-all"
            />
            {isLoading ? (
              <Loader2 className="absolute right-14 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            ) : searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <button
              type="button"
              onClick={closeSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </form>

          {/* Search Content */}
          <div className="max-w-3xl mx-auto mt-6">
            {/* Search Results */}
            {results.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Products</h3>
                <div className="space-y-2">
                  {results.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.slug}`}
                      onClick={closeSearch}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <img
                        src={getProductImage(product, { w: 80, h: 80 })}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 group-hover:text-orange-600 truncate transition-colors">
                          {product.name}
                        </h4>
                        <p className="text-sm text-gray-500">{product.category_name}</p>
                      </div>
                      <div className="text-right">
                        {product.sale_price ? (
                          <>
                            <p className="font-bold text-orange-600">
                              {formatPrice(product.sale_price)}
                            </p>
                            <p className="text-sm text-gray-400 line-through">
                              {formatPrice(product.base_price)}
                            </p>
                          </>
                        ) : (
                          <p className="font-bold">{formatPrice(product.base_price)}</p>
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
                    </Link>
                  ))}
                </div>
                
                {searchQuery && (
                  <button
                    onClick={() => handleQuickSearch(searchQuery)}
                    className="w-full mt-4 py-3 text-center text-orange-600 font-medium hover:bg-orange-50 rounded-xl transition-colors"
                  >
                    View all results for "{searchQuery}"
                  </button>
                )}
              </div>
            )}

            {/* No Results */}
            {searchQuery.length >= 2 && !isLoading && results.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No products found for "{searchQuery}"</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </div>
            )}

            {/* Default State - Trending & Recent */}
            {searchQuery.length < 2 && (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-4">
                      <Clock className="w-4 h-4" />
                      Recent Searches
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((search) => (
                        <button
                          key={search}
                          onClick={() => handleQuickSearch(search)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                        >
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Searches */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-4">
                    <TrendingUp className="w-4 h-4" />
                    Trending Now
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((search) => (
                      <button
                        key={search}
                        onClick={() => handleQuickSearch(search)}
                        className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-full text-sm transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      <div className="flex-1" onClick={closeSearch} />
    </div>
  );
}
