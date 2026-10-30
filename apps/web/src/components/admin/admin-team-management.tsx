"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@ui/card";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { Badge } from "@ui/badge";
import { AuthUser, resolveTicketAssigneeId } from "@lib/helpers";
import type { Ticket } from "@components/ticket-list";
import { useState, FormEvent } from "react";

export interface StaffInviteRecord {
  id: string;
  code: string;
  email: string;
  role: "AGENT" | "ADMIN";
  expiresAt: string;
  accepted: boolean;
  acceptedAt?: string | null;
  createdAt: string;
}

interface AdminTeamManagementProps {
  agents: AuthUser[];
  tickets: Ticket[];
  subtab: "MEMBERS" | "INVITE" | "PROVISION";
  onSelectSubtab: (subtab: "MEMBERS" | "INVITE" | "PROVISION") => void;
  invites: StaffInviteRecord[];
  onCreateInvite: (data: { email: string; role: "AGENT" | "ADMIN" }) => void;
  isCreatingInvite: boolean;
  inviteSuccessMessage: string | null;
  inviteError: string | null;
  generatedInviteCode: string | null;
  onCopyInviteLink: (code: string) => void;
  copiedLink: boolean;
  onRevokeInvite: (id: string) => void;
  onProvisionUser: (data: {
    fullName: string;
    email: string;
    password: string;
    role: "AGENT" | "ADMIN";
  }) => void;
  isProvisioning: boolean;
  provisionSuccessMessage: string | null;
  provisionError: string | null;
}

export function AdminTeamManagement({
  agents,
  tickets,
  subtab,
  onSelectSubtab,
  invites,
  onCreateInvite,
  isCreatingInvite,
  inviteSuccessMessage,
  inviteError,
  generatedInviteCode,
  onCopyInviteLink,
  copiedLink,
  onRevokeInvite,
  onProvisionUser,
  isProvisioning,
  provisionSuccessMessage,
  provisionError,
}: AdminTeamManagementProps) {
  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"AGENT" | "ADMIN">("AGENT");

  const [provisionFullName, setProvisionFullName] = useState("");
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionPassword, setProvisionPassword] = useState("");
  const [provisionRole, setProvisionRole] = useState<"AGENT" | "ADMIN">(
    "AGENT",
  );

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    onCreateInvite({ email: inviteEmail, role: inviteRole });
  };

  const handleProvisionSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!provisionFullName || !provisionEmail || !provisionPassword) return;
    onProvisionUser({
      fullName: provisionFullName,
      email: provisionEmail,
      password: provisionPassword,
      role: provisionRole,
    });
  };

  return (
    <div className="space-y-6">
      {/* Subtab Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-spruce-200 dark:border-spruce-800 pb-3">
        <Button
          type="button"
          size="sm"
          variant={subtab === "MEMBERS" ? "default" : "outline"}
          onClick={() => onSelectSubtab("MEMBERS")}
          className="text-xs font-semibold"
        >
          IT Staff Members ({agents.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={subtab === "INVITE" ? "default" : "outline"}
          onClick={() => onSelectSubtab("INVITE")}
          className="text-xs font-semibold"
        >
          Generate Staff Invitation
        </Button>
        <Button
          type="button"
          size="sm"
          variant={subtab === "PROVISION" ? "default" : "outline"}
          onClick={() => onSelectSubtab("PROVISION")}
          className="text-xs font-semibold"
        >
          Direct Provision Account
        </Button>
      </div>

      {/* SUBTAB 1: TEAM MEMBERS */}
      {subtab === "MEMBERS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const assignedCount = tickets.filter(
                (t) =>
                  resolveTicketAssigneeId(t) === agent.id &&
                  t.status !== "CLOSED",
              ).length;
              return (
                <Card
                  key={agent.id}
                  className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm"
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-200 font-bold flex items-center justify-center shrink-0 border border-spruce-300 dark:border-spruce-700 text-xs shadow-xs">
                        {agent.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate text-spruce-950 dark:text-white">
                          {agent.fullName}
                        </p>
                        <p className="text-xs text-spruce-600 dark:text-spruce-300 truncate">
                          {agent.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge
                        variant={
                          agent.role === "ADMIN" ? "default" : "secondary"
                        }
                      >
                        {agent.role}
                      </Badge>
                      <p className="text-[11px] text-spruce-700 dark:text-spruce-200 font-medium">
                        {assignedCount} active{" "}
                        {assignedCount === 1 ? "ticket" : "tickets"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: GENERATE STAFF INVITATION */}
      {subtab === "INVITE" && (
        <div className="space-y-6">
          <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-spruce-950 dark:text-white">
                Issue Staff Invitation Link / Code
              </CardTitle>
              <p className="text-xs text-spruce-600 dark:text-spruce-300 leading-relaxed">
                Generate a secure invitation link for new Support Engineers or
                Administrators. Public registration only creates customer
                accounts; staff members must redeem this invitation to activate
                engineer permissions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {inviteSuccessMessage && (
                <div className="p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                  {inviteSuccessMessage}
                </div>
              )}
              {inviteError && (
                <div className="p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300">
                  {inviteError}
                </div>
              )}

              <form
                onSubmit={handleInviteSubmit}
                className="space-y-4 max-w-xl"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="invite-email"
                    className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                  >
                    Staff Email Address
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="engineer@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="invite-role"
                    className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                  >
                    Staff Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "AGENT" | "ADMIN")
                    }
                    className="flex h-9 w-full rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
                  >
                    <option value="AGENT">Support Engineer (AGENT)</option>
                    <option value="ADMIN">Administrator (ADMIN)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingInvite || !inviteEmail}
                  className="text-xs"
                >
                  {isCreatingInvite
                    ? "Generating..."
                    : "Generate Invitation Link"}
                </Button>
              </form>

              {generatedInviteCode && (
                <div className="p-4 rounded-lg bg-spruce-50 dark:bg-spruce-950/80 border border-spruce-300 dark:border-spruce-700 space-y-2">
                  <span className="text-xs font-bold text-spruce-900 dark:text-spruce-200 uppercase tracking-wider">
                    Active Invitation Link Generated
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <Input
                      readOnly
                      value={
                        typeof window !== "undefined"
                          ? `${window.location.origin}?invite=${generatedInviteCode}`
                          : generatedInviteCode
                      }
                      className="text-xs font-mono h-9 bg-white dark:bg-spruce-900 text-spruce-950 dark:text-white border-spruce-300 dark:border-spruce-700 flex-1"
                    />
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => onCopyInviteLink(generatedInviteCode)}
                      className="text-xs shrink-0 bg-spruce-800 hover:bg-spruce-900 text-white dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950 font-semibold"
                    >
                      {copiedLink ? "Copied to Clipboard!" : "Copy Invite Link"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-spruce-600 dark:text-spruce-300">
                    The recipient can open this link to register their staff
                    account directly.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending & Historical Invites List */}
          <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-spruce-950 dark:text-white">
                Staff Invitations ({invites.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invites.length === 0 ? (
                <p className="p-6 text-center text-xs text-spruce-600 dark:text-spruce-400">
                  No staff invitations issued yet.
                </p>
              ) : (
                <div className="divide-y divide-spruce-100 dark:divide-spruce-800/80 overflow-x-auto">
                  {invites.map((invite) => {
                    const isExpired = new Date() > new Date(invite.expiresAt);
                    return (
                      <div
                        key={invite.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-spruce-950 dark:text-white">
                              {invite.email}
                            </strong>
                            <Badge
                              variant={
                                invite.role === "ADMIN"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {invite.role}
                            </Badge>
                            {invite.accepted ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
                                Redeemed
                              </span>
                            ) : isExpired ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-semibold">
                                Expired
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold">
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-spruce-600 dark:text-spruce-300 font-mono">
                            Code:{" "}
                            <span className="font-semibold text-spruce-900 dark:text-spruce-100">
                              {invite.code}
                            </span>{" "}
                            • Expires{" "}
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {!invite.accepted && !isExpired && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onCopyInviteLink(invite.code)}
                              className="h-7 text-[11px] border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-800 hover:bg-spruce-100 dark:hover:bg-spruce-700 text-spruce-800 dark:text-spruce-200 shadow-xs"
                            >
                              Copy Link
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRevokeInvite(invite.id)}
                            className="h-7 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUBTAB 3: DIRECT PROVISIONING */}
      {subtab === "PROVISION" && (
        <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm max-w-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-spruce-950 dark:text-white">
              Directly Provision Staff Account
            </CardTitle>
            <p className="text-xs text-spruce-600 dark:text-spruce-300 leading-relaxed">
              Create an IT Support Engineer or Administrator account immediately
              with an initial password.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {provisionSuccessMessage && (
              <div className="p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                {provisionSuccessMessage}
              </div>
            )}
            {provisionError && (
              <div className="p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300">
                {provisionError}
              </div>
            )}

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="provision-name"
                  className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                >
                  Full Name
                </label>
                <Input
                  id="provision-name"
                  placeholder="e.g. Alex Rivera"
                  value={provisionFullName}
                  onChange={(e) => setProvisionFullName(e.target.value)}
                  required
                  className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="provision-email"
                  className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                >
                  Email Address
                </label>
                <Input
                  id="provision-email"
                  type="email"
                  placeholder="alex.rivera@company.com"
                  value={provisionEmail}
                  onChange={(e) => setProvisionEmail(e.target.value)}
                  required
                  className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="provision-password"
                  className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                >
                  Initial Password
                </label>
                <Input
                  id="provision-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={provisionPassword}
                  onChange={(e) => setProvisionPassword(e.target.value)}
                  required
                  className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="provision-role"
                  className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                >
                  Account Role
                </label>
                <select
                  id="provision-role"
                  value={provisionRole}
                  onChange={(e) =>
                    setProvisionRole(e.target.value as "AGENT" | "ADMIN")
                  }
                  className="flex h-9 w-full rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
                >
                  <option value="AGENT">Support Engineer (AGENT)</option>
                  <option value="ADMIN">Administrator (ADMIN)</option>
                </select>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isProvisioning}
                className="text-xs"
              >
                {isProvisioning ? "Provisioning..." : "Provision Staff Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
