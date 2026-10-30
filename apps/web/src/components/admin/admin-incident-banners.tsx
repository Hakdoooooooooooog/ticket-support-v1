"use client";

import React, { useState, useEffect, useCallback, FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Power,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  incidentBannersControllerFindAll,
  incidentBannersControllerCreate,
  incidentBannersControllerUpdate,
  incidentBannersControllerDelete,
} from "@/api/endpoints/incident-banners/incident-banners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface AdminIncidentBanner {
  id: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  isActive: boolean;
  affectedServices: string[];
  createdAt: string;
  createdBy?: {
    fullName: string;
    email: string;
  };
}

export function AdminIncidentBanners() {
  const [banners, setBanners] = useState<AdminIncidentBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"INFO" | "WARNING" | "CRITICAL">(
    "WARNING",
  );
  const [affectedServicesInput, setAffectedServicesInput] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const data = await incidentBannersControllerFindAll();
      setBanners(data as any);
      setError(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to fetch incident banners",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    try {
      setIsSubmitting(true);
      const services = affectedServicesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await incidentBannersControllerCreate({
        title: title.trim(),
        message: message.trim(),
        severity,
        isActive,
        affectedServices: services,
      });

      // Reset form
      setTitle("");
      setMessage("");
      setSeverity("WARNING");
      setAffectedServicesInput("");
      setIsActive(true);
      setShowCreateForm(false);

      await fetchBanners();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to publish incident banner",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: AdminIncidentBanner) => {
    try {
      await incidentBannersControllerUpdate(banner.id, {
        isActive: !banner.isActive,
      });
      await fetchBanners();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to toggle banner state");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this outage banner?",
      )
    )
      return;
    try {
      await incidentBannersControllerDelete(id);
      await fetchBanners();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete banner");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-incident-banners-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Global Incident & Maintenance Banners
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Broadcast platform outage notices, degraded service warnings, and
            scheduled maintenance to customers and staff in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBanners}
            disabled={loading}
            title="Refresh"
          >
            <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="gap-1.5"
            data-testid="create-incident-banner-btn"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Cancel" : "Publish Outage Banner"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm border border-destructive/20 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-semibold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {showCreateForm && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">
              Publish New Global Incident Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Headline Title
                  </label>
                  <Input
                    placeholder="e.g. Scheduled Database Maintenance"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    data-testid="banner-title-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Severity Level
                  </label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    data-testid="banner-severity-select"
                  >
                    <option value="INFO">Info (Blue Notice)</option>
                    <option value="WARNING">Warning (Amber Degradation)</option>
                    <option value="CRITICAL">Critical (Red Outage)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Customer Status Message
                </label>
                <Textarea
                  placeholder="Detail the affected systems, expected downtime, and workarounds for users..."
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  data-testid="banner-message-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Affected Services{" "}
                    <span className="text-muted-foreground text-[11px]">
                      (comma-separated)
                    </span>
                  </label>
                  <Input
                    placeholder="e.g. API, SSO Login, Webhooks"
                    value={affectedServicesInput}
                    onChange={(e) => setAffectedServicesInput(e.target.value)}
                    data-testid="banner-services-input"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="banner-is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label
                    htmlFor="banner-is-active"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Broadcast banner immediately upon creation
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="submit-banner-btn"
                >
                  {isSubmitting ? "Publishing..." : "Publish Banner"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && banners.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Loading incident notices...
        </div>
      ) : banners.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <CardContent className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="font-semibold text-base">All Systems Operational</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              There are currently no active incident banners or scheduled
              maintenance warnings configured.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Outage Notice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => {
            const isCritical = banner.severity === "CRITICAL";
            const isWarning = banner.severity === "WARNING";

            return (
              <Card
                key={banner.id}
                className={`transition-colors ${
                  banner.isActive
                    ? isCritical
                      ? "border-red-500/50 bg-red-500/5"
                      : isWarning
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-blue-500/50 bg-blue-500/5"
                    : "opacity-60 bg-muted/20"
                }`}
                data-testid={`admin-banner-card-${banner.id}`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            isCritical
                              ? "destructive"
                              : isWarning
                                ? "secondary"
                                : "default"
                          }
                          className="font-semibold"
                        >
                          {banner.severity}
                        </Badge>
                        <Badge
                          variant={banner.isActive ? "default" : "outline"}
                          className={
                            banner.isActive
                              ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                              : "text-muted-foreground"
                          }
                        >
                          {banner.isActive ? "BROADCASTING LIVE" : "INACTIVE"}
                        </Badge>
                        <h3 className="font-semibold text-base">
                          {banner.title}
                        </h3>
                      </div>

                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {banner.message}
                      </p>

                      {banner.affectedServices &&
                        banner.affectedServices.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-xs text-muted-foreground self-center">
                              Affected Services:
                            </span>
                            {banner.affectedServices.map((service, idx) => (
                              <span
                                key={idx}
                                className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border"
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        )}

                      <div className="text-xs text-muted-foreground pt-1">
                        Posted by {banner.createdBy?.fullName || "Admin"} on{" "}
                        {new Date(banner.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                      <Button
                        size="sm"
                        variant={banner.isActive ? "outline" : "default"}
                        onClick={() => handleToggleActive(banner)}
                        className="gap-1.5"
                        title={
                          banner.isActive
                            ? "Deactivate banner"
                            : "Broadcast banner"
                        }
                      >
                        <Power className="h-3.5 w-3.5" />
                        {banner.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(banner.id)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Delete banner"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
