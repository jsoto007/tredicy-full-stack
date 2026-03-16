const MAX_RATING = 5;

export default function Stars({ rating = 5 }) {
  const value = Math.max(0, Math.min(MAX_RATING, Math.round(rating)));

  return (
    <div className="flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <span
          key={index}
          className={index < value ? 'text-black' : 'text-gray-400'}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}
