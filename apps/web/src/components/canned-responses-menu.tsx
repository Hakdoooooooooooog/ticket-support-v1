'use client';

import * as React from 'react';
import { CANNED_RESPONSES, CannedResponseTemplate } from '@lib/helpers';

interface CannedResponsesMenuProps {
  onSelect: (content: string) => void;
  className?: string;
  buttonLabel?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down' | 'auto';
}

export function CannedResponsesMenu({
  onSelect,
  className = '',
  buttonLabel = '⚡ Canned Responses',
  align = 'right',
  direction = 'auto',
}: CannedResponsesMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [computedDirection, setComputedDirection] = React.useState<'up' | 'down'>('down');
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const categories = React.useMemo(() => {
    const map = new Map<string, CannedResponseTemplate[]>();
    for (const item of CANNED_RESPONSES) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, []);

  const handleToggle = () => {
    if (!isOpen && menuRef.current) {
      if (direction === 'up') {
        setComputedDirection('up');
      } else if (direction === 'down') {
        setComputedDirection('down');
      } else {
        // Auto-detect based on remaining viewport space below the button
        const rect = menuRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setComputedDirection(spaceBelow < 320 ? 'up' : 'down');
      }
    }
    setIsOpen((prev) => !prev);
  };

  const handlePick = (content: string) => {
    onSelect(content);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-700 bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span>{buttonLabel}</span>
        <span className="text-[9px] text-slate-400">
          {computedDirection === 'up' && isOpen ? '▴' : '▾'}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${
            computedDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } w-72 sm:w-80 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-800/80`}
        >
          <div className="p-2.5 bg-slate-950/60 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Quick Reply Templates
            </span>
            <span className="text-[10px] text-slate-500">Insert technical snippet</span>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-2">
            {categories.map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handlePick(tmpl.content)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-blue-600/20 hover:text-blue-300 text-slate-300 text-xs transition-colors flex flex-col group"
                    >
                      <span className="font-medium text-slate-200 group-hover:text-blue-200">
                        {tmpl.label}
                      </span>
                      <span className="text-[11px] text-slate-500 line-clamp-1">
                        {tmpl.content}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
