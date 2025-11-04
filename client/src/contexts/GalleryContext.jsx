import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import localGallery from '../data/galleries.json';
import { apiGet } from '../lib/api.js';

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

const GalleryContext = createContext(null);

export function GalleryProvider({ children }) {
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
  const [activeSlug, setActiveSlug] = useState(fallback.categories[0]?.slug ?? '');
  const [galleryBySlug, setGalleryBySlug] = useState(fallback.grouped);
  const [messagesBySlug, setMessagesBySlug] = useState({});
  const [statusBySlug, setStatusBySlug] = useState(() =>
    fallback.categories.reduce((acc, category) => {
      acc[category.slug] = { loading: false, loaded: Boolean(fallback.grouped[category.slug]?.length) };
      return acc;
    }, {})
  );
  const [initializing, setInitializing] = useState(true);

  const statusRef = useRef(statusBySlug);
  useEffect(() => {
    statusRef.current = statusBySlug;
  }, [statusBySlug]);

  const activeSlugRef = useRef(activeSlug);
  useEffect(() => {
    activeSlugRef.current = activeSlug;
  }, [activeSlug]);

  const ensureFallbackMessages = useCallback(() => {
    setMessagesBySlug((prev) => {
      const next = { ...prev };
      fallback.categories.forEach((category) => {
        if (!next[category.slug]) {
          next[category.slug] = 'Offline mode - showing studio highlights.';
        }
      });
      return next;
    });
    setStatusBySlug((prev) => {
      const next = { ...prev };
      fallback.categories.forEach((category) => {
        const current = next[category.slug] ?? {};
        next[category.slug] = { ...current, loading: false, loaded: true };
      });
      return next;
    });
  }, [fallback]);

  const fetchCategoryItems = useCallback(
    async (category, { signal, force = false } = {}) => {
      if (!category) {
        return;
      }
      const slug = category.slug;
      const currentStatus = statusRef.current?.[slug];

      if (!force) {
        if (currentStatus?.loading) {
          return;
        }
        if (currentStatus?.loaded) {
          return;
        }
      }

      setStatusBySlug((prev) => ({
        ...prev,
        [slug]: { ...(prev[slug] ?? {}), loading: true }
      }));

      try {
        const queryParam = category.id ? `category_id=${category.id}` : `category=${slug}`;
        const data = await apiGet(`/api/gallery?${queryParam}`, { signal });
        if (signal?.aborted) {
          setStatusBySlug((prev) => ({
            ...prev,
            [slug]: { ...(prev[slug] ?? {}), loading: false }
          }));
          return;
        }
        const normalized = Array.isArray(data)
          ? data.map((item) => ({
              id: item.id,
              image_url: item.image_url,
              alt: item.alt,
              caption: item.caption,
              category_name: item.category?.name || category.name,
              category_slug: slug
            }))
          : [];

        setGalleryBySlug((prev) => ({
          ...prev,
          [slug]: normalized.length ? normalized : fallback.grouped[slug] || []
        }));
        setMessagesBySlug((prev) => ({
          ...prev,
          [slug]: normalized.length ? null : 'Showing studio highlights.'
        }));
        setStatusBySlug((prev) => ({
          ...prev,
          [slug]: { loading: false, loaded: true }
        }));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') {
          setStatusBySlug((prev) => ({
            ...prev,
            [slug]: { ...(prev[slug] ?? {}), loading: false }
          }));
          return;
        }
        setGalleryBySlug((prev) => ({
          ...prev,
          [slug]: fallback.grouped[slug] || []
        }));
        setMessagesBySlug((prev) => ({
          ...prev,
          [slug]: 'Offline mode - showing studio highlights.'
        }));
        setStatusBySlug((prev) => ({
          ...prev,
          [slug]: { loading: false, loaded: true }
        }));
      }
    },
    [fallback]
  );

  useEffect(() => {
    setStatusBySlug((prev) => {
      let changed = false;
      const next = { ...prev };
      categories.forEach((category) => {
        if (!next[category.slug]) {
          next[category.slug] = {
            loading: false,
            loaded: Boolean(galleryBySlug[category.slug]?.length)
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [categories, galleryBySlug]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function bootstrap() {
      setInitializing(true);
      try {
        const data = await apiGet('/api/gallery/categories', { signal: controller.signal });
        if (ignore) {
          return;
        }
        if (Array.isArray(data) && data.length) {
          const nextCategories = data.map((category) => {
            const slug = slugify(category.name);
            return {
              id: category.id,
              slug,
              name: category.name,
              isFallback: false
            };
          });

          setCategories(nextCategories);
          setGalleryBySlug((prev) => {
            const next = { ...prev };
            nextCategories.forEach((category) => {
              if (!next[category.slug]) {
                next[category.slug] = fallback.grouped[category.slug] || [];
              }
            });
            return next;
          });

          const currentActive = activeSlugRef.current;
          const nextActive = nextCategories.find((category) => category.slug === currentActive)
            ? currentActive
            : nextCategories[0]?.slug ?? currentActive;
          setActiveSlug(nextActive);

          await Promise.all(
            nextCategories.map((category) =>
              fetchCategoryItems(category, { signal: controller.signal, force: true })
            )
          );
        } else {
          ensureFallbackMessages();
        }
      } catch (error) {
        if (!ignore && error.name !== 'AbortError') {
          ensureFallbackMessages();
        }
      } finally {
        if (!ignore) {
          setInitializing(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [ensureFallbackMessages, fetchCategoryItems]);

  const selectCategory = useCallback(
    (slug) => {
      if (!slug || slug === activeSlugRef.current) {
        return;
      }
      const category = categories.find((item) => item.slug === slug);
      if (!category) {
        return;
      }
      setActiveSlug(slug);
      fetchCategoryItems(category);
    },
    [categories, fetchCategoryItems]
  );

  const value = useMemo(
    () => ({
      categories,
      galleryBySlug,
      messagesBySlug,
      statusBySlug,
      activeSlug,
      initializing,
      selectCategory
    }),
    [categories, galleryBySlug, messagesBySlug, statusBySlug, activeSlug, initializing, selectCategory]
  );

  return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>;
}

export function useGallery() {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery must be used within a GalleryProvider');
  }
  return context;
}
