import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import React from "react";

interface EfferdDashboard2Props {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function EfferdDashboard2({ title, subtitle, children }: EfferdDashboard2Props) {
	return (
    <AppShell title={title} subtitle={subtitle}>
      {children || <Dashboard />}
    </AppShell>
  );
}

export default EfferdDashboard2;
