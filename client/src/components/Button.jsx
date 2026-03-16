function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f7863] focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const variants = {
  primary: 'bg-[#2a3923] text-white hover:bg-[#6f7863]',
  secondary:
    'border border-[#2a3923] text-[#2a3923] hover:bg-[#2a3923] hover:text-white',
  ghost: 'text-[#6f7863] hover:text-[#2a3923]',
  light: 'bg-[#f3e7d9] text-[#2a3923] hover:bg-[#e8d9c8]',
};

export default function Button({ as: Component = 'button', variant = 'primary', className = '', children, ...props }) {
  const variantClasses = variants[variant] || variants.primary;

  return (
    <Component className={classNames(baseClasses, variantClasses, className)} {...props}>
      {children}
    </Component>
  );
}
