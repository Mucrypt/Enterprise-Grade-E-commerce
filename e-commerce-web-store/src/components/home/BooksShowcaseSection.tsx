import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { booksApi } from '../../api';
import BookCard from '../books/BookCard';

const extractBooks = (payload: unknown) => {
  const data = payload as {
    books?: unknown[];
    items?: unknown[];
    data?: unknown[];
  } | undefined;

  return (data?.books || data?.items || data?.data || []) as any[];
};

export default function BooksShowcaseSection() {
  const { data } = useQuery({
    queryKey: ['books-showcase'],
    queryFn: async () => booksApi.getAll({ limit: 4 }),
  });

  const books = extractBooks(data).slice(0, 4);

  if (books.length === 0) return null;

  return (
    <section className='px-4 py-16 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='mb-8 flex flex-col gap-4 rounded-4xl bg-linear-to-r from-slate-950 via-slate-900 to-orange-800 px-6 py-8 text-white shadow-2xl lg:flex-row lg:items-end lg:justify-between'>
          <div className='max-w-2xl'>
            <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-orange-200'>
              <Sparkles className='h-3.5 w-3.5' />
              Books marketplace
            </div>
            <h2 className='mt-4 text-3xl font-black tracking-tight sm:text-4xl'>
              Discover creator-led titles built for reading, downloading, and sharing.
            </h2>
            <p className='mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base'>
              A faster path to revenue starts with a real catalog. Explore books, samples, and format-ready releases from the storefront.
            </p>
          </div>

          <Link
            to='/books'
            className='inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:translate-x-1'
          >
            Browse books
            <ArrowRight className='h-4 w-4' />
          </Link>
        </div>

        <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>

        <div className='mt-6 flex items-center justify-between rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900'>
          <span className='inline-flex items-center gap-2 font-medium'>
            <BookOpen className='h-4 w-4' />
            Every listing can surface a sample, multiple formats, and creator information.
          </span>
          <Link to='/books' className='font-semibold text-orange-700 hover:underline'>
            Open the catalog
          </Link>
        </div>
      </div>
    </section>
  );
}