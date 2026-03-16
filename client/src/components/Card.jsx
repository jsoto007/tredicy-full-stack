function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'rounded-[2rem] border border-[#d9cbbc] bg-[#fffdf9]/92 p-6 shadow-[0_18px_50px_rgba(42,57,35,0.08)] backdrop-blur-sm transition sm:p-8';

export default function Card({ className = '', children, ...props }) {
  return (
    <div className={classNames(baseClasses, className)} {...props}>
      {children}
    </div>
  );
}
