import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, BookOpen, Filter } from 'lucide-react';
import { booksApi } from '../api';
import BookCard from '../components/books/BookCard';

const extractBooks = (payload: unknown) => {
  const data = payload as { books?: unknown[]; items?: unknown[]; data?: unknown[] } | undefined;
  return (data?.books || data?.items || data?.data || []) as any[];
};

export default function BooksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['books-catalog'],
    queryFn: async () => booksApi.getAll({ limit: 24 }),
  });

  const books = useMemo(() => extractBooks(data), [data]);

  const formatOptions = useMemo(() => {
    const formats = new Set<string>();
    books.forEach((book) => {
      ;(book.available_formats || book.availableFormats || []).forEach((format: string) =>
        formats.add(format),
      );
    });
    return ['all', ...Array.from(formats)];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const haystack = [
        book.title,
        book.author_name || book.authorName,
        book.subtitle,
        book.description,
        book.excerpt,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = query.length === 0 || haystack.includes(query);
      const formats = book.available_formats || book.availableFormats || [];
      const matchesFormat = selectedFormat === 'all' || formats.includes(selectedFormat);

      return matchesSearch && matchesFormat;
    });
  }, [books, searchQuery, selectedFormat]);

  return (
    <div className='px-4 py-10 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl space-y-8'>
        <div className='rounded-4xl bg-linear-to-br from-slate-950 via-slate-900 to-orange-700 px-6 py-10 text-white shadow-2xl sm:px-8'>
          <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-orange-200'>
            <BookOpen className='h-3.5 w-3.5' />
            Books catalog
          </div>
          <h1 className='mt-4 text-4xl font-black tracking-tight sm:text-5xl'>
            A real marketplace for creator-led books.
          </h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base'>
            Search the catalog, filter by format, and open any title for sample reading and release details.
          </p>

          <div className='mt-6 grid gap-3 lg:grid-cols-[1fr_auto]'>
            <div className='flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-gray-900 shadow-lg'>
              <Search className='h-5 w-5 text-gray-400' />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder='Search titles, creators, or summaries'
                className='w-full bg-transparent text-sm outline-none placeholder:text-gray-400'
              />
            </div>
            <div className='flex items-center gap-2 overflow-x-auto rounded-2xl bg-white/10 px-3 py-2'>
              <Filter className='h-4 w-4 text-orange-200' />
              {formatOptions.map((format) => (
                <button
                  key={format}
                  type='button'
                  onClick={() => setSelectedFormat(format)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedFormat === format
                      ? 'bg-white text-slate-950'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {format === 'all' ? 'All formats' : format}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className='h-105 animate-pulse rounded-2xl bg-gray-200' />
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className='rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center'>
            <BookOpen className='mx-auto h-10 w-10 text-gray-400' />
            <h2 className='mt-4 text-xl font-bold text-gray-900'>No books matched your filters</h2>
            <p className='mt-2 text-sm text-gray-500'>
              Try a different search term or remove the selected format filter.
            </p>
          </div>
        ) : (
          <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}