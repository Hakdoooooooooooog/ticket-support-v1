"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { incidentBannersControllerFindActive } from "@/api/endpoints/incident-banners/incident-banners";

export interface IncidentBannerData {
  id: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  isActive: boolean;
  affectedServices: string[];
  createdAt: string;
}

export function GlobalIncidentBanner() {
  const [banners, setBanners] = useState<IncidentBannerData[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchActiveBanners = useCallback(async () => {
    try {
      const data = await incidentBannersControllerFindActive();
      if (Array.isArray(data)) {
        setBanners(data as any);
      }
    } catch {
      // Non-blocking if API is momentarily unreachable
    }
  }, []);

  useEffect(() => {
    fetchActiveBanners();
    const interval = setInterval(fetchActiveBanners, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [fetchActiveBanners]);

  const activeVisibleBanners = banners.filter(
    (b) => b.isActive && !dismissedIds.has(b.id),
  );

  if (activeVisibleBanners.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="w-full space-y-2 z-50 mb-4"
      data-testid="global-incident-banner-container"
    >
      {activeVisibleBanners.map((banner) => {
        const isCritical = banner.severity === "CRITICAL";
        const isWarning = banner.severity === "WARNING";
        const isExpanded = expandedIds.has(banner.id);

        const bannerClasses = isCritical
          ? "bg-red-500/15 border-red-500/40 text-red-900 dark:text-red-200"
          : isWarning
            ? "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200"
            : "bg-blue-500/15 border-blue-500/40 text-blue-900 dark:text-blue-200";

        const iconClasses = isCritical
          ? "text-red-600 dark:text-red-400"
          : isWarning
            ? "text-amber-600 dark:text-amber-400"
            : "text-blue-600 dark:text-blue-400";

        return (
          <aside
            key={banner.id}
            aria-label="System Incident Alert"
            role="status"
            className={`border rounded-lg p-3 sm:p-4 transition-all duration-200 shadow-sm ${bannerClasses}`}
            data-testid={`incident-banner-${banner.severity.toLowerCase()}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 shrink-0">
                  {isCritical ? (
                    <AlertCircle
                      className={`h-5 w-5 ${iconClasses} animate-pulse`}
                    />
                  ) : isWarning ? (
                    <AlertTriangle className={`h-5 w-5 ${iconClasses}`} />
                  ) : (
                    <Info className={`h-5 w-5 ${iconClasses}`} />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isCritical
                          ? "bg-red-500/20 text-red-700 dark:text-red-300"
                          : isWarning
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {banner.severity} INCIDENT
                    </span>
                    <h4 className="font-semibold text-sm sm:text-base leading-snug">
                      {banner.title}
                    </h4>
                  </div>

                  <p
                    className={`mt-1 text-xs sm:text-sm leading-relaxed opacity-90 ${
                      !isExpanded && banner.message.length > 140
                        ? "line-clamp-2"
                        : ""
                    }`}
                  >
                    {banner.message}
                  </p>

                  {banner.affectedServices &&
                    banner.affectedServices.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[11px] font-medium opacity-75 mr-1 self-center">
                          Affected:
                        </span>
                        {banner.affectedServices.map((service, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                {banner.message.length > 140 && (
                  <button
                    onClick={() => toggleExpand(banner.id)}
                    aria-label={
                      isExpanded
                        ? "Collapse incident details"
                        : "Expand incident details"
                    }
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-80 hover:opacity-100"
                    title={isExpanded ? "Show less" : "Show more"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(banner.id)}
                  aria-label="Dismiss incident banner"
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-80 hover:opacity-100"
                  title="Dismiss alert"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        );
      })}
    </div>
  );
}
