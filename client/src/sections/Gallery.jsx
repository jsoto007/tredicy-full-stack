import { useEffect, useMemo, useState } from 'react';
import Tabs from '../components/Tabs.jsx';
import Lightbox from '../components/Lightbox.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import localGallery from '../data/galleries.json';
import { apiGet, resolveApiUrl } from '../lib/api.js';

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function toTitleCase(slug) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupByCategory(data) {
  return data.reduce((acc, item) => {
    const slug = item.category || slugify(item.category_name || item.category || 'uncategorized');
    acc[slug] = acc[slug] ? acc[slug].concat(item) : [item];
    return acc;
  }, {});
}

export default function Gallery() {
  const fallback = useMemo(() => {
    const grouped = groupByCategory(localGallery);
    const categories = Object.keys(grouped).map((slug) => ({
      id: null,
      slug,
      name: toTitleCase(slug),
      isFallback: true
    }));
    return { grouped, categories };
  }, []);

  const [categories, setCategories] = useState(fallback.categories);
  const [activeSlug, setActiveSlug] = useState(() => fallback.categories[0]?.slug ?? '');
  const [galleryData, setGalleryData] = useState(fallback.grouped);
  const [messages, setMessages] = useState({});
  const [loadingSlug, setLoadingSlug] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const data = await apiGet('/api/gallery/categories', { signal: controller.signal });
        if (ignore || !Array.isArray(data) || !data.length) {
          return;
        }
        const nextCategories = data.map((category) => {
          const slug = slugify(category.name);
          return {
            id: category.id,
            slug,
            name: category.name,
            isFallback: false
          };
        });
        const nextActive = nextCategories.find((category) => category.slug === activeSlug)
          ? activeSlug
          : nextCategories[0]?.slug ?? activeSlug;

        setCategories(nextCategories);
        setGalleryData((prev) => {
          const next = { ...prev };
          nextCategories.forEach((category) => {
            if (!next[category.slug]) {
              next[category.slug] = fallback.grouped[category.slug] || [];
            }
          });
          return next;
        });
        setActiveSlug(nextActive);
      } catch (error) {
        // Fall back to local data silently.
      }
    }

    loadCategories();

    return () => {
      ignore = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug, fallback]);

  useEffect(() => {
    if (!activeSlug) {
      return undefined;
    }

    const category = categories.find((item) => item.slug === activeSlug);
    if (!category) {
      return undefined;
    }

    const controller = new AbortController();

    async function load() {
      setLoadingSlug(activeSlug);
      try {
        const queryParam = category.id ? `category_id=${category.id}` : `category=${category.slug}`;
        const data = await apiGet(`/api/gallery?${queryParam}`, { signal: controller.signal });
        const normalized = Array.isArray(data)
          ? data.map((item) => ({
              id: item.id,
              image_url: item.image_url,
              alt: item.alt,
              caption: item.caption,
              category_name: item.category?.name || category.name,
              category_slug: category.slug
            }))
          : [];

        setGalleryData((prev) => ({
          ...prev,
          [category.slug]: normalized.length ? normalized : fallback.grouped[category.slug] || []
        }));
        setMessages((prev) => ({
          ...prev,
          [category.slug]: normalized.length ? null : 'Showing studio highlights.'
        }));
      } catch (error) {
        setGalleryData((prev) => ({
          ...prev,
          [category.slug]: fallback.grouped[category.slug] || []
        }));
        setMessages((prev) => ({
          ...prev,
          [category.slug]: 'Offline mode - showing studio highlights.'
        }));
      } finally {
        setLoadingSlug(null);
      }
    }

    load();

    return () => controller.abort();
  }, [activeSlug, categories, fallback]);

  const tabs = categories.map((category) => ({
    id: category.slug,
    label: category.name
  }));

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
          onTabChange={setActiveSlug}
          renderPanel={(tabId, { isActive }) => {
            const items = galleryData[tabId] || [];
            const message = messages[tabId];
            const isLoading = loadingSlug === tabId;

            if (isActive && isLoading) {
              return (
                <div className="py-10 text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {message ? (
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{message}</p>
                ) : null}
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
              </div>
            );
          }}
        />
      </div>
      <Lightbox open={Boolean(selectedImage)} image={selectedImage} onClose={() => setSelectedImage(null)} />
    </section>
  );
}
