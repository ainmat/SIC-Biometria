import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";

export function EfferdDashboard2({ title, subtitle, children }) {
	return (
    <AppShell title={title} subtitle={subtitle}>
      {children || <Dashboard />}
    </AppShell>
  );
}

export default EfferdDashboard2;
