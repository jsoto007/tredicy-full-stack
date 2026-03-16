import { useId, useRef } from 'react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Tabs({ tabs, activeTab, onTabChange, renderPanel }) {
  const tablistId = useId();
  const tabRefs = useRef([]);

  const focusTab = (index) => {
    const node = tabRefs.current[index];
    if (node) {
      node.focus();
    }
  };

  const handleKeyDown = (event, currentIndex) => {
    if (!tabs.length) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      onTabChange(tabs[nextIndex].id);
      focusTab(nextIndex);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      onTabChange(tabs[prevIndex].id);
      focusTab(prevIndex);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onTabChange(tabs[0].id);
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = tabs.length - 1;
      onTabChange(tabs[lastIndex].id);
      focusTab(lastIndex);
    }
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Tabs"
        className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 text-xs font-semibold uppercase tracking-[0.3em]"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTab;
          const tabId = `${tablistId}-tab-${tab.id}`;
          const panelId = `${tablistId}-panel-${tab.id}`;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={tabId}
              type="button"
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls={panelId}
              className={classNames(
                'rounded-full px-4 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                selected
                  ? 'bg-black text-white shadow-soft'
                  : 'text-gray-600 hover:text-black'
              )}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mt-10">
        {tabs.map((tab) => {
          const tabId = `${tablistId}-tab-${tab.id}`;
          const panelId = `${tablistId}-panel-${tab.id}`;
          const isActive = tab.id === activeTab;
          return (
            <div key={tab.id} id={panelId} role="tabpanel" aria-labelledby={tabId} hidden={!isActive}>
              {renderPanel ? renderPanel(tab.id, { isActive }) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
