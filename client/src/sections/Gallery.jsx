import { useMemo, useState } from 'react';
import Tabs from '../components/Tabs.jsx';
import Lightbox from '../components/Lightbox.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useGallery } from '../contexts/GalleryContext.jsx';
import { resolveApiUrl } from '../lib/api.js';

export default function Gallery() {
  const {
    categories,
    galleryBySlug,
    messagesBySlug,
    statusBySlug,
    activeSlug,
    initializing,
    selectCategory
  } = useGallery();
  const [selectedImage, setSelectedImage] = useState(null);

  const tabs = useMemo(
    () =>
      categories.map((category) => ({
        id: category.slug,
        label: category.name
      })),
    [categories]
  );

  return (
    <section id="work" className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6">
        <SectionTitle
          eyebrow="Gallery"
          title="Work in focus"
          description="A curated look at recent pieces across blackwork, fine line detailing, and tonal color. Tap to inspect the craft up close."
        />
        <Tabs
          tabs={tabs}
          activeTab={activeSlug}
          onTabChange={selectCategory}
          renderPanel={(tabId, { isActive }) => {
            const items = galleryBySlug[tabId] || [];
            const message = messagesBySlug[tabId];
            const isLoading = Boolean(statusBySlug[tabId]?.loading);
            const showLoader = !items.length && (isLoading || initializing);
            const showRefreshingNotice = isActive && isLoading && items.length > 0;

            return (
              <div className="space-y-6">
                {message ? (
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{message}</p>
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
                  <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
                    {items.map((item) => {
                      const imageUrl = resolveApiUrl(item.image_url);
                      return (
                        <button
                          key={item.id || `${tabId}-${item.image_url}`}
                          type="button"
                          onClick={() => setSelectedImage({ ...item, image_url: imageUrl })}
                          className="mb-6 block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-soft transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-800 dark:bg-gray-900 dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black"
                        >
                          <img src={imageUrl} alt={item.alt} loading="lazy" className="w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
      <Lightbox open={Boolean(selectedImage)} image={selectedImage} onClose={() => setSelectedImage(null)} />
    </section>
  );
}
