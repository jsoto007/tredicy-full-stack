import { useEffect, useState } from 'react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function ProgressiveImage({
  src,
  alt,
  priority = false,
  className = '',
  imageClassName = '',
  onLoad,
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className={classNames('relative isolate overflow-hidden bg-gray-100', className)}>
      <div
        className={classNames(
          'absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100',
          loaded && 'opacity-0 transition-opacity duration-200'
        )}
        aria-hidden="true"
      />
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
        className={classNames(
          'relative z-10 h-full w-full object-cover transition duration-500',
          loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm',
          imageClassName
        )}
        {...rest}
      />
    </div>
  );
}
