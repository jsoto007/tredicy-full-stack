import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../lib/api.js';

const CATEGORIES_KEY = ['gallery', 'categories'];
const ITEMS_KEY = (categoryKey) => ['gallery', 'items', categoryKey];

function normaliseCategory(category) {
  const slug = (category?.name || '').toLowerCase().replace(/\s+/g, '-');
  return {
    id: category?.id,
    slug,
    name: category?.name || 'Untitled',
    description: category?.description || null,
    is_active: Boolean(category?.is_active)
  };
}

function normaliseGalleryItems(response, fallbackCategory) {
  if (Array.isArray(response)) {
    return response;
  }
  if (response?.items && Array.isArray(response.items)) {
    return response.items.map((item) => ({
      ...item,
      category: item.category || (fallbackCategory ? normaliseCategory(fallbackCategory) : null)
    }));
  }
  return [];
}

export function useGalleryCategories(options = {}) {
  const query = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async () => {
      const data = await apiGet('/api/gallery/categories');
      return Array.isArray(data) ? data.map(normaliseCategory) : [];
    },
    staleTime: 5 * 60_000,
    ...options
  });

  const categories = query.data ?? [];

  return {
    ...query,
    categories,
    activeCategory: categories[0] || null
  };
}

export function useGalleryItems({ categoryId, slug, enabled = true, perPage = 24 } = {}) {
  const queryClient = useQueryClient();
  const key = slug || categoryId || 'all';

  const query = useQuery({
    queryKey: ITEMS_KEY(key),
    enabled: enabled && Boolean(key),
    keepPreviousData: true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryId) {
        params.set('category_id', categoryId);
      } else if (slug) {
        params.set('category', slug);
      }
      params.set('per_page', perPage);

      const payload = await apiGet(`/api/gallery?${params.toString()}`);
      return {
        items: normaliseGalleryItems(payload, null),
        meta: payload?.meta ?? null
      };
    }
  });

  const prefetch = useCallback(
    async (nextCategory) => {
      if (!nextCategory) {
        return;
      }
      const nextKey = nextCategory.slug || nextCategory.id || 'all';
      await queryClient.prefetchQuery({
        queryKey: ITEMS_KEY(nextKey),
        queryFn: async () => {
          const params = new URLSearchParams();
          if (nextCategory.id) {
            params.set('category_id', nextCategory.id);
          } else if (nextCategory.slug) {
            params.set('category', nextCategory.slug);
          }
          params.set('per_page', perPage);
          const payload = await apiGet(`/api/gallery?${params.toString()}`);
          return {
            items: normaliseGalleryItems(payload, nextCategory),
            meta: payload?.meta ?? null
          };
        }
      });
    },
    [perPage, queryClient]
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const meta = query.data?.meta ?? null;

  return {
    ...query,
    items,
    meta,
    prefetch
  };
}
