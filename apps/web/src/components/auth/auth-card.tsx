"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@ui/card";
import { ReactNode } from "react";

export interface AuthCardProps {
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  isStaffInvite?: boolean;
  staffRole?: "ADMIN" | "AGENT";
  children: ReactNode;
}

export function AuthCard({
  mode,
  onModeChange,
  isStaffInvite,
  staffRole,
  children,
}: AuthCardProps) {
  return (
    <Card className="shadow-2xl shadow-spruce-950/60 border-spruce-200/90 dark:border-spruce-700/80 dark:border-t-spruce-600/40 dark:bg-spruce-900/95 backdrop-blur-md">
      <CardHeader className="space-y-4 pb-4">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-spruce-100/90 dark:bg-spruce-950/90 border border-spruce-200 dark:border-spruce-800/90 shadow-inner">
          <button
            type="button"
            onClick={() => onModeChange("login")}
            className={`py-2 px-3 text-xs sm:text-sm rounded-lg transition-all duration-150 ${
              mode === "login"
                ? "bg-white text-spruce-950 shadow-sm border border-spruce-200/60 dark:bg-spruce-800 dark:text-white dark:border dark:border-spruce-600/80 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] font-semibold"
                : "text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-spruce-200 font-medium"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onModeChange("register")}
            className={`py-2 px-3 text-xs sm:text-sm rounded-lg transition-all duration-150 ${
              mode === "register"
                ? "bg-white text-spruce-950 shadow-sm border border-spruce-200/60 dark:bg-spruce-800 dark:text-white dark:border dark:border-spruce-600/80 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] font-semibold"
                : "text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-spruce-200 font-medium"
            }`}
          >
            Create Account
          </button>
        </div>

        <div>
          <CardTitle className="text-xl font-bold tracking-tight text-spruce-950 dark:text-white">
            {mode === "login" ? "Welcome back" : "Register an account"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-spruce-600 dark:text-spruce-300/90 mt-1">
            {mode === "login"
              ? "Enter your email and password to continue."
              : isStaffInvite
                ? `Staff Invitation: Registering as ${staffRole === "ADMIN" ? "Administrator" : "Support Engineer"}.`
                : "Register as a customer to submit and track support tickets."}
          </CardDescription>
        </div>
      </CardHeader>

      {children}
    </Card>
  );
}
