import { fetchPortfoliosFromSupabase } from "@/lib/fetchPortfoliosFromSupabase";
import { PortfolioDashboardShell } from "@/components/portfolio-dashboard-shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const portfolios = await fetchPortfoliosFromSupabase();
  return <PortfolioDashboardShell portfolios={portfolios} />;
}
