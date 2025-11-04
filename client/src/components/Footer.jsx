const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-black/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 text-sm text-gray-600 dark:text-gray-400 md:flex-row md:items-center md:justify-between">
        <p className="uppercase tracking-[0.3em]">
          © {year} BLACKWORKNYC ·{' '}
          <a
            href="https://sotodev.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-black dark:hover:text-gray-100"
          >
            Powered by SotoDev, LLC
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-6 uppercase tracking-[0.2em]">
          <a href="#booking" className="hover:text-black dark:hover:text-gray-100">
            Aftercare
          </a>
          <a href="#faq" className="hover:text-black dark:hover:text-gray-100">
            Policies
          </a>
          <a href="#top" className="hover:text-black dark:hover:text-gray-100">
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
