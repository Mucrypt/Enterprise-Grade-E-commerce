// ============================================
// Category Card Component
// ============================================

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getPlaceholderImage, cn } from '../../utils';
import type { Category } from '../../types';

interface CategoryCardProps {
  category: Category;
  variant?: 'default' | 'large' | 'compact';
}

export default function CategoryCard({ category, variant = 'default' }: CategoryCardProps) {
  const image = category.image_url || getPlaceholderImage(300, 300, category.name.replace(' ', '+'));

  if (variant === 'compact') {
    return (
      <Link
        to={`/category/${category.slug}`}
        className="flex items-center gap-3 p-3 bg-white rounded-xl hover:shadow-md transition-all group"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
          <img
            src={image}
            alt={category.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
            {category.name}
          </h3>
          {category.product_count !== undefined && (
            <p className="text-sm text-gray-500">{category.product_count} products</p>
          )}
        </div>
        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
      </Link>
    );
  }

  if (variant === 'large') {
    return (
      <Link
        to={`/category/${category.slug}`}
        className="relative group block aspect-4/3 rounded-2xl overflow-hidden"
      >
        <img
          src={image}
          alt={category.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h3 className="text-2xl font-bold mb-2">{category.name}</h3>
          <p className="text-white/80 line-clamp-2">{category.description}</p>
          <span className="inline-flex items-center gap-2 mt-4 font-medium group-hover:gap-3 transition-all">
            Shop Now <ArrowRight className="w-5 h-5" />
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/category/${category.slug}`}
      className="group flex flex-col items-center text-center"
    >
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-100 overflow-hidden mb-3 ring-4 ring-transparent group-hover:ring-orange-200 transition-all">
        <img
          src={image}
          alt={category.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
      </div>
      <h3 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
        {category.name}
      </h3>
      {category.product_count !== undefined && (
        <p className="text-sm text-gray-500">{category.product_count} items</p>
      )}
    </Link>
  );
}
