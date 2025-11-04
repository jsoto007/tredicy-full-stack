function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-soft backdrop-blur-sm transition dark:border-gray-800 dark:bg-gray-950/80 sm:p-8';

export default function Card({ className = '', children, ...props }) {
  return (
    <div className={classNames(baseClasses, className)} {...props}>
      {children}
    </div>
  );
}
