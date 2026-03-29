function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'rounded-2xl border border-ts-stone bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover sm:p-8';

export default function Card({ className = '', children, ...props }) {
  return (
    <div className={classNames(baseClasses, className)} {...props}>
      {children}
    </div>
  );
}
