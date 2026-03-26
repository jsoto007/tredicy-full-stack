function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-gray-700';



export default function Badge({ className = '', children, ...props }) {
  return (
    <span className={classNames(baseClasses, className)} {...props}>
      {children}
    </span>
  );
}
