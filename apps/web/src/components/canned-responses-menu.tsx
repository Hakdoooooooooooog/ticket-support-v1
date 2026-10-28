'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CANNED_RESPONSES,
  CannedResponseTemplate,
  CannedResponseInterpolationContext,
  interpolateCannedResponse,
} from '@lib/helpers';
import { apiClient } from '@lib/api-client';

interface CannedResponsesMenuProps {
  onSelect: (content: string) => void;
  className?: string;
  buttonLabel?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down' | 'auto';
  context?: CannedResponseInterpolationContext;
  templates?: CannedResponseTemplate[];
}

export function CannedResponsesMenu({
  onSelect,
  className = '',
  buttonLabel = 'Canned Responses',
  align = 'right',
  direction = 'auto',
  context,
  templates: providedTemplates,
}: CannedResponsesMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [computedDirection, setComputedDirection] = React.useState<'up' | 'down'>('down');
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Fetch organization canned responses from API when not provided via props
  const { data: fetchedTemplates } = useQuery<CannedResponseTemplate[]>({
    queryKey: ['canned-responses'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CannedResponseTemplate[]>('/canned-responses');
        return res.data;
      } catch {
        return CANNED_RESPONSES;
      }
    },
    enabled: !providedTemplates,
    staleTime: 60 * 1000,
  });

  const activeTemplates = providedTemplates || fetchedTemplates || CANNED_RESPONSES;

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
    for (const item of activeTemplates) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [activeTemplates]);

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

  const handlePick = (rawContent: string) => {
    const interpolated = interpolateCannedResponse(rawContent, context);
    onSelect(interpolated);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-800/90 text-spruce-700 dark:text-spruce-200 hover:text-spruce-950 dark:hover:text-white hover:bg-spruce-100 dark:hover:bg-spruce-700/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400"
      >
        <span>{buttonLabel}</span>
        <span className="text-[9px] text-spruce-500 dark:text-spruce-400">
          {computedDirection === 'up' && isOpen ? '▴' : '▾'}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${
            computedDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } w-72 sm:w-80 rounded-xl border border-spruce-200 dark:border-spruce-700/80 bg-white/95 dark:bg-spruce-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-100 divide-y divide-spruce-100 dark:divide-spruce-800/80`}
        >
          <div className="p-2.5 bg-spruce-50/80 dark:bg-spruce-950/60 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-spruce-900 dark:text-spruce-200 uppercase tracking-wider">
              Quick Reply Templates
            </span>
            <span className="text-[10px] text-spruce-500">Insert technical snippet</span>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-2">
            {categories.map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 pt-1 text-[10px] font-bold text-spruce-600 dark:text-spruce-400 uppercase tracking-wider">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handlePick(tmpl.content)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-spruce-100 dark:hover:bg-spruce-800/80 hover:text-spruce-950 dark:hover:text-spruce-100 text-spruce-700 dark:text-spruce-300 text-xs transition-colors flex flex-col group"
                    >
                      <span className="font-medium text-spruce-900 dark:text-spruce-200 group-hover:text-spruce-950 dark:group-hover:text-white">
                        {tmpl.label}
                      </span>
                      <span className="text-[11px] text-spruce-500 line-clamp-1">
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
