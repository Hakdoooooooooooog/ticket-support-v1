'use client';

import { Input } from '@ui/input';

export interface NotificationFiltersProps {
  activeFilter: 'ALL' | 'UNREAD';
  onFilterChange: (filter: 'ALL' | 'UNREAD') => void;
  totalCount: number;
  unreadCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function NotificationFilters({
  activeFilter,
  onFilterChange,
  totalCount,
  unreadCount,
  searchQuery,
  onSearchChange,
}: NotificationFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-spruce-100/80 border border-spruce-200 dark:bg-spruce-900/60 dark:border-spruce-800 w-fit">
        <button
          type="button"
          onClick={() => onFilterChange('ALL')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeFilter === 'ALL'
              ? 'bg-spruce-800 text-white shadow dark:bg-spruce-300 dark:text-spruce-950'
              : 'text-spruce-600 hover:text-spruce-900 dark:text-spruce-400 dark:hover:text-spruce-200'
          }`}
        >
          All ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('UNREAD')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeFilter === 'UNREAD'
              ? 'bg-spruce-800 text-white shadow dark:bg-spruce-300 dark:text-spruce-950'
              : 'text-spruce-600 hover:text-spruce-900 dark:text-spruce-400 dark:hover:text-spruce-200'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <div className="w-full sm:w-72">
        <Input
          placeholder="Search notifications..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="text-xs bg-white border-spruce-300 text-spruce-950 placeholder:text-spruce-400 dark:bg-spruce-950 dark:border-spruce-700/80 dark:text-spruce-100 dark:placeholder:text-spruce-500"
        />
      </div>
    </div>
  );
}
