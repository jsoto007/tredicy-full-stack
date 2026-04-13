const inFlight = new Map();

/**
 * Append a ?w= width hint to an upload URL so the server can serve a
 * resized thumbnail. Falls back to the original URL for non-upload paths.
 */
export function thumbUrl(src, width) {
  if (!src || !width) return src;
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}w=${width}`;
}

export function prefetchImage(url, { priority = false } = {}) {
  if (!url) {
    return Promise.resolve();
  }
  const cached = inFlight.get(url);
  if (cached === true) {
    return Promise.resolve();
  }
  if (cached) {
    return cached;
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    if (priority) {
      img.loading = 'eager';
      img.decoding = 'async';
      img.fetchPriority = 'high';
    }
    img.onload = () => {
      inFlight.set(url, true);
      resolve();
    };
    img.onerror = (error) => {
      inFlight.delete(url);
      reject(error);
    };
    img.src = url;
  }).catch(() => {});

  inFlight.set(url, promise);
  return promise;
}
