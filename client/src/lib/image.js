const inFlight = new Map();

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
