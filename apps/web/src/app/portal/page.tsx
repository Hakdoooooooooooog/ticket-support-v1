"use client";

import { useRouter } from "next/navigation";
import { TicketForm } from "@components/forms/ticket-form";
import { TicketList } from "@components/ticket-list";
import { AppHeader } from "@components/navigation/app-header";
import { ContextualLoader } from "@ui/contextual-loader";
import { getStoredSession } from "@lib/helpers";
import { APP_VERSION } from "@lib/constants";
import { useAuthStore } from "@store/auth.store";
import { useTicketsStore } from "@store/tickets.store";
import { usePortalStore } from "@store/portal.store";
import { useRealtimeEvents } from "@hooks/use-realtime-events";
import { useMounted } from "@hooks/use-mounted";
import { PortalQuickStats } from "@components/portal/portal-quick-stats";
import { PortalKnowledgeBase } from "@components/portal/portal-knowledge-base";
import { GlobalIncidentBanner } from "@components/incident-banner";
import { useCallback, useEffect } from "react";

export default function CustomerPortalPage() {
  const router = useRouter();
  const isMounted = useMounted();
  const { status: realtimeStatus } = useRealtimeEvents();
  const {
    user,
    isSessionVerified,
    isVerifyingSession,
    ensureSessionVerified,
    clearSession,
  } = useAuthStore();
  const { tickets, clearTickets, highlightTicket } = useTicketsStore();
  const { activeTab, setActiveTab } = usePortalStore();

  const handleSelectTicket = useCallback(
    (ticketId: string) => {
      setActiveTab("tickets");
      highlightTicket(ticketId);
    },
    [highlightTicket, setActiveTab],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetTicketId = params.get("ticketId");
    if (targetTicketId) {
      const timer = setTimeout(() => {
        handleSelectTicket(targetTicketId);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [handleSelectTicket]);

  useEffect(() => {
    if (isSessionVerified && user) {
      return;
    }

    const stored = getStoredSession();
    if (!stored?.accessToken && !user) {
      router.replace("/");
      return;
    }

    ensureSessionVerified().then((verified) => {
      if (!verified) {
        router.replace("/");
      }
    });
  }, [isSessionVerified, user, ensureSessionVerified, router]);

  const handleSignOut = () => {
    clearSession();
    clearTickets();
    router.replace("/");
  };

  if (!user?.fullName || isVerifyingSession || !isSessionVerified) {
    return <ContextualLoader context="portal-auth" />;
  }

  const activeTicketsCount = tickets.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-spruce-50 dark:bg-spruce-950 text-spruce-950 dark:text-spruce-50">
      <AppHeader
        user={user}
        realtimeStatus={realtimeStatus}
        onSignOut={handleSignOut}
        onSelectTicket={handleSelectTicket}
        titleBadge="Customer Portal"
        showAdminSwitch={user?.role === "ADMIN" || user?.role === "AGENT"}
      />

      <main className="flex-1 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Header & Welcome */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-spruce-950 dark:text-white">
                Customer Support Portal
              </h1>
              <p className="text-xs sm:text-sm text-spruce-600 dark:text-spruce-300">
                Welcome back,{" "}
                <span className="font-semibold" suppressHydrationWarning>
                  {user?.fullName || "Customer"}
                </span>
                . Submit helpdesk requests, track status in real-time, or
                resolve common issues instantly.
              </p>
            </div>

            {/* Quick action button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    activeTab === "tickets" ? "knowledge-base" : "tickets",
                  )
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-spruce-800 hover:bg-spruce-900 text-white dark:bg-spruce-100 dark:text-spruce-950 dark:hover:bg-white shadow-xs transition-all cursor-pointer"
              >
                {activeTab === "tickets" ? (
                  <>
                    <span>Browse Self-Service KB</span>
                    <span>&rarr;</span>
                  </>
                ) : (
                  <>
                    <span>View My Tickets</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Global Incident Outage & Maintenance Banner */}
          <GlobalIncidentBanner />

          {/* Quick Metrics / Dashboard Overview Header */}
          <PortalQuickStats />

          {/* Module Tab Navigation */}
          <div className="border-b border-spruce-200 dark:border-spruce-800">
            <nav
              className="-mb-px flex space-x-6 sm:space-x-8"
              aria-label="Portal Navigation Tabs"
            >
              <button
                type="button"
                onClick={() => setActiveTab("tickets")}
                className={`py-3.5 px-1 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "tickets"
                    ? "border-spruce-800 text-spruce-950 dark:border-spruce-300 dark:text-white font-bold"
                    : "border-transparent text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white"
                }`}
              >
                <span>Tickets & Requests</span>
                {activeTicketsCount > 0 && (
                  <span
                    suppressHydrationWarning
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-spruce-200 text-spruce-900 dark:bg-spruce-800 dark:text-spruce-200"
                  >
                    {activeTicketsCount} Active
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("knowledge-base")}
                className={`py-3.5 px-1 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "knowledge-base"
                    ? "border-spruce-800 text-spruce-950 dark:border-spruce-300 dark:text-white font-bold"
                    : "border-transparent text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white"
                }`}
              >
                <span>Knowledge Base & FAQs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-spruce-100 text-spruce-700 dark:bg-spruce-800 dark:text-spruce-300">
                  10 Guides
                </span>
              </button>
            </nav>
          </div>

          {/* Tab 1: Tickets & Requests */}
          {activeTab === "tickets" && (
            <div className="space-y-6">
              {/* Proactive Knowledge Base Callout Banner */}
              <div className="bg-white dark:bg-spruce-900/90 border border-spruce-200 dark:border-spruce-800 border-l-4 border-l-spruce-600 dark:border-l-spruce-400 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-spruce-950 dark:text-white">
                    Need an immediate resolution without waiting for an
                    engineer?
                  </p>
                  <p className="text-xs text-spruce-600 dark:text-spruce-300">
                    Self-service fixes are available for VPN gateway timeouts,
                    SSO 2FA locks, Outlook sync, and billing receipts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("knowledge-base")}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-spruce-300 dark:border-spruce-700 bg-spruce-50 hover:bg-spruce-100 dark:bg-spruce-800 dark:hover:bg-spruce-700 text-spruce-900 dark:text-spruce-100 transition-colors cursor-pointer"
                >
                  Explore Knowledge Base &rarr;
                </button>
              </div>

              {/* 2-Column Ticket Intake & Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-5">
                  <TicketForm creatorId={user?.id} />
                </div>
                <div className="lg:col-span-7">
                  <TicketList />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Knowledge Base & FAQs */}
          {activeTab === "knowledge-base" && <PortalKnowledgeBase />}
        </div>
      </main>

      <footer className="border-t border-spruce-200 dark:border-spruce-800 py-6 px-4 sm:px-6 lg:px-8 text-xs text-spruce-600 dark:text-spruce-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>TicketSupport Helpdesk Platform</p>
          <p className="font-mono text-[11px] text-spruce-500/80 dark:text-spruce-400/70">
            Version {APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
}
