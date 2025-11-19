import { useEffect, useMemo, useState } from 'react';
import { useGalleryCategories, useGalleryItems } from '../contexts/GalleryContext.jsx';
import FadeIn from '../components/FadeIn.jsx';
import Tabs from '../components/Tabs.jsx';
import Lightbox from '../components/Lightbox.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { resolveApiUrl } from '../lib/api.js';

export default function Gallery() {
  const {
    categories,
    isLoading: categoriesLoading,
    isError: categoriesError
  } = useGalleryCategories();
  const [activeSlug, setActiveSlug] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (!categories.length) {
      setActiveSlug('');
      return;
    }
    setActiveSlug((prev) => {
      if (prev && categories.some((category) => category.slug === prev)) {
        return prev;
      }
      return categories[0].slug;
    });
  }, [categories]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.slug === activeSlug) || categories[0] || null,
    [categories, activeSlug]
  );

  const {
    items,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
    error: itemsError,
    prefetch
  } = useGalleryItems({
    categoryId: activeCategory?.id,
    slug: activeCategory?.slug,
    enabled: Boolean(activeCategory)
  });

  useEffect(() => {
    const upcoming = categories.filter((category) => category.slug !== activeCategory?.slug).slice(0, 2);
    upcoming.forEach((category) => {
      void prefetch(category);
    });
  }, [categories, activeCategory?.slug, prefetch]);

  const tabs = useMemo(
    () =>
      categories.map((category) => ({
        id: category.slug,
        label: category.name
      })),
    [categories]
  );
  const hasTabs = tabs.length > 0;
  const isLoading = categoriesLoading || itemsLoading;
  const isRefreshing = itemsFetching && !itemsLoading;
  const showMessage = itemsError ? 'Unable to load this gallery right now.' : !items.length ? 'No artwork published yet.' : null;
  const globalMessage = categoriesError ? 'Unable to load gallery right now.' : null;

  const handleTabChange = (slug) => {
    if (!slug || slug === activeSlug) {
      return;
    }
    setActiveSlug(slug);
    const upcoming = categories.find((category) => category.slug === slug);
    if (upcoming) {
      void prefetch(upcoming);
    }
  };

  return (
    <section id="work" className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6">
        <SectionTitle
          eyebrow="Gallery"
          title="Work in focus"
          description="A curated look at recent pieces across blackwork, fine line detailing, and tonal color. Tap to inspect the craft up close."
        />
        {hasTabs ? (
          <Tabs
            tabs={tabs}
            activeTab={activeSlug}
            onTabChange={handleTabChange}
            renderPanel={(tabId) => {
              const panelActive = tabId === activeSlug;
              const panelItems = panelActive ? items : [];
              const showLoader = panelActive && !items.length && isLoading;
              const showRefreshingNotice = panelActive && isRefreshing && items.length > 0;
              const fadeKey =
                panelItems.map((item) => item.id ?? item.image_url ?? '').join('|') || `${tabId}-empty`;

              return (
                <div className="space-y-6">
                  {panelActive && showMessage ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{showMessage}</p>
                  ) : null}
                  {showRefreshingNotice ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                      Refreshing gallery…
                    </p>
                  ) : null}
                  {showLoader ? (
                    <div className="py-10 text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                      Loading gallery…
                    </div>
                  ) : (
                    <FadeIn
                      key={`${tabId}-${fadeKey}`}
                      className="columns-1 gap-6 sm:columns-2 lg:columns-3"
                      childClassName="mb-6 break-inside-avoid"
                      delayStep={0.08}
                    >
                      {panelItems.map((item) => {
                        const imageUrl = resolveApiUrl(item.image_url);
                        return (
                          <button
                            key={item.id || `${tabId}-${item.image_url}`}
                            type="button"
                            onClick={() => setSelectedImage({ ...item, image_url: imageUrl })}
                            className="block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-soft transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-800 dark:bg-gray-900 dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black"
                          >
                            <img src={imageUrl} alt={item.alt} loading="lazy" className="w-full object-cover" />
                          </button>
                        );
                      })}
                    </FadeIn>
                  )}
                </div>
              );
            }}
          />
        ) : (
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            {isLoading ? 'Loading gallery…' : globalMessage || 'Gallery will be published soon.'}
          </div>
        )}
      </div>
      <Lightbox open={Boolean(selectedImage)} image={selectedImage} onClose={() => setSelectedImage(null)} />
    </section>
  );
}
