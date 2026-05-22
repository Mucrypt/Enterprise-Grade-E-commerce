import { Link } from 'react-router-dom';
import { BookOpen, FileText, Headphones, ArrowRight } from 'lucide-react';
import { cn, formatPrice } from '../../utils';
import type { Book } from '../../types';

export interface BookCardProps {
  book: Book;
  variant?: 'default' | 'compact';
}

export default function BookCard({ book, variant = 'default' }: BookCardProps) {
  const formats = book.available_formats || book.availableFormats || [];
  const author = book.author_name || book.authorName || 'Editorial team';
  const cover = book.cover_image_url || book.coverImageUrl;
  const price = book.price != null ? formatPrice(Number(book.price)) : 'Free sample';

  return (
    <Link
      to={`/books/${book.id}`}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        variant === 'compact' && 'flex gap-4 rounded-xl p-4',
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-orange-700',
          variant === 'compact' ? 'h-28 w-20 rounded-xl shrink-0' : 'aspect-3/4',
        )}
      >
        {cover ? (
          <img
            src={cover}
            alt={book.title}
            className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center p-6 text-center text-white'>
            <div>
              <BookOpen className='mx-auto h-12 w-12 opacity-90' />
              <p className='mt-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/75'>
                Book
              </p>
            </div>
          </div>
        )}
        <div className='absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/20 to-transparent p-4 text-white'>
          <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-white/75'>
            <FileText className='h-3.5 w-3.5' />
            Digital release
          </div>
        </div>
      </div>

      <div className={cn('p-4', variant === 'compact' && 'flex-1 p-0') }>
        <div className='flex flex-wrap gap-2'>
          {formats.slice(0, 3).map((format) => (
            <span
              key={format}
              className='rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700'
            >
              {format}
            </span>
          ))}
          {formats.length === 0 && (
            <span className='rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600'>
              Sample available
            </span>
          )}
        </div>

        <h3 className='mt-3 text-lg font-bold text-gray-900 group-hover:text-orange-600'>
          {book.title}
        </h3>
        <p className='mt-1 text-sm text-gray-500'>{author}</p>

        {variant === 'default' && (
          <p className='mt-3 line-clamp-3 text-sm leading-6 text-gray-600'>
            {book.excerpt || book.description || 'Browse the sample, formats, and delivery options for this title.'}
          </p>
        )}

        <div className='mt-4 flex items-center justify-between gap-4'>
          <div>
            <p className='text-xs uppercase tracking-[0.2em] text-gray-400'>Starting at</p>
            <p className='text-lg font-bold text-gray-900'>{price}</p>
          </div>
          <div className='inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-transform group-hover:translate-x-1'>
            <span>Open</span>
            <ArrowRight className='h-4 w-4' />
          </div>
        </div>

        {variant === 'default' && (
          <div className='mt-4 flex items-center gap-3 text-xs text-gray-500'>
            <span className='inline-flex items-center gap-1'>
              <Headphones className='h-3.5 w-3.5' />
              Reading ready
            </span>
            <span>•</span>
            <span>Sample preview included</span>
          </div>
        )}
      </div>
    </Link>
  );
}