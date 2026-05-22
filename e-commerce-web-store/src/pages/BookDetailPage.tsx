import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, Sparkles, Star } from 'lucide-react';
import { booksApi } from '../api';
import type { Book, BookSampleAccess } from '../types';
import { formatPrice } from '../utils';

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [sampleAccess, setSampleAccess] = useState<BookSampleAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBook = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const bookData = await booksApi.getById(id);
        setBook(bookData);

        try {
          const sample = await booksApi.getSampleAccess(id);
          setSampleAccess((sample as { access?: BookSampleAccess })?.access || (sample as BookSampleAccess));
        } catch {
          setSampleAccess(null);
        }
      } catch (error) {
        console.error('Failed to load book:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [id]);

  if (loading) {
    return (
      <div className='px-4 py-10 sm:px-6 lg:px-8'>
        <div className='mx-auto max-w-7xl grid gap-8 lg:grid-cols-[420px_1fr]'>
          <div className='aspect-3/4 animate-pulse rounded-3xl bg-gray-200' />
          <div className='space-y-4'>
            <div className='h-8 w-3/4 animate-pulse rounded bg-gray-200' />
            <div className='h-5 w-1/2 animate-pulse rounded bg-gray-200' />
            <div className='h-40 animate-pulse rounded-2xl bg-gray-200' />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className='px-4 py-10 sm:px-6 lg:px-8'>
        <div className='mx-auto max-w-3xl rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center'>
          <BookOpen className='mx-auto h-12 w-12 text-gray-400' />
          <h1 className='mt-4 text-2xl font-bold text-gray-900'>Book not found</h1>
          <p className='mt-2 text-sm text-gray-500'>The title may have been removed or is still being prepared for publication.</p>
          <Link to='/books' className='mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white'>
            <ArrowLeft className='h-4 w-4' />
            Back to books
          </Link>
        </div>
      </div>
    );
  }

  const formats = book.available_formats || book.availableFormats || [];
  const author = book.author_name || book.authorName || 'Editorial team';
  const cover = book.cover_image_url || book.coverImageUrl;
  const price = book.price != null ? formatPrice(Number(book.price)) : 'Free sample';

  return (
    <div className='px-4 py-10 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl space-y-8'>
        <Link to='/books' className='inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:underline'>
          <ArrowLeft className='h-4 w-4' />
          Back to books
        </Link>

        <div className='grid gap-8 lg:grid-cols-[420px_1fr]'>
          <div className='space-y-4'>
            <div className='overflow-hidden rounded-4xl bg-linear-to-br from-slate-950 via-slate-900 to-orange-700 shadow-2xl'>
              {cover ? (
                <img src={cover} alt={book.title} className='aspect-3/4 w-full object-cover' />
              ) : (
                <div className='flex aspect-3/4 items-center justify-center p-8 text-center text-white'>
                  <div>
                    <Sparkles className='mx-auto h-16 w-16 text-orange-200' />
                    <p className='mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-white/70'>Digital reading</p>
                  </div>
                </div>
              )}
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='rounded-2xl border bg-white p-4'>
                <p className='text-xs uppercase tracking-[0.2em] text-gray-400'>Price</p>
                <p className='mt-1 text-lg font-bold text-gray-900'>{price}</p>
              </div>
              <div className='rounded-2xl border bg-white p-4'>
                <p className='text-xs uppercase tracking-[0.2em] text-gray-400'>Formats</p>
                <p className='mt-1 text-lg font-bold text-gray-900'>{formats.length || 1}</p>
              </div>
            </div>
          </div>

          <div className='space-y-6'>
            <div className='space-y-3'>
              <div className='inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-orange-700'>
                <Star className='h-3.5 w-3.5 fill-current' />
                Featured release
              </div>
              <h1 className='text-4xl font-black tracking-tight text-gray-950 sm:text-5xl'>{book.title}</h1>
              <p className='text-lg text-gray-600'>By {author}</p>
            </div>

            <div className='flex flex-wrap gap-2'>
              {formats.map((format) => (
                <span key={format} className='rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700'>
                  {format}
                </span>
              ))}
            </div>

            <p className='max-w-3xl text-base leading-8 text-gray-600'>
              {book.description || book.excerpt || 'Open the title page, inspect the sample preview, and move the reader from discovery to purchase-ready intent.'}
            </p>

            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='rounded-2xl bg-slate-950 p-5 text-white'>
                <p className='text-xs uppercase tracking-[0.2em] text-white/60'>Sample access</p>
                <p className='mt-2 text-lg font-semibold'>Preview ready</p>
              </div>
              <div className='rounded-2xl border p-5'>
                <p className='text-xs uppercase tracking-[0.2em] text-gray-400'>Creator flow</p>
                <p className='mt-2 text-lg font-semibold text-gray-900'>Publishing support</p>
              </div>
              <div className='rounded-2xl border p-5'>
                <p className='text-xs uppercase tracking-[0.2em] text-gray-400'>Delivery</p>
                <p className='mt-2 text-lg font-semibold text-gray-900'>Instant download</p>
              </div>
            </div>

            <div className='rounded-4xl border bg-white p-6 shadow-sm'>
              <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <div>
                  <p className='text-sm font-semibold text-gray-500'>Sample preview</p>
                  <h2 className='mt-1 text-2xl font-bold text-gray-950'>Read before you buy</h2>
                </div>
                <div className='flex gap-3'>
                  {sampleAccess?.accessUrl || sampleAccess?.access_url ? (
                    <a
                      href={sampleAccess.accessUrl || sampleAccess.access_url}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white'
                    >
                      <Download className='h-4 w-4' />
                      Open sample
                    </a>
                  ) : (
                    <button
                      type='button'
                      disabled
                      className='inline-flex items-center gap-2 rounded-full bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400'
                    >
                      <Download className='h-4 w-4' />
                      Sample pending
                    </button>
                  )}
                </div>
              </div>

              <div className='mt-6 rounded-3xl bg-linear-to-br from-gray-50 to-orange-50 p-6'>
                <p className='text-sm font-semibold uppercase tracking-[0.25em] text-orange-700'>Why this page matters</p>
                <p className='mt-3 max-w-3xl text-sm leading-7 text-gray-600'>
                  This detail layout turns each title into a conversion surface: it highlights the creator, explains the value proposition, and gives the buyer a low-friction sample path.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}