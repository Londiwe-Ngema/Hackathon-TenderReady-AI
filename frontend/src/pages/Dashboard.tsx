import { AlarmClock, AlertTriangle, Building2, FileStack, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, EmptyState, ErrorBox, PageHeader, ProgressBar, Spinner, StatTile, StatusBadge } from "../components/ui";
import { closingLabel, formatDateTime } from "../lib/format";
import { useDashboard } from "../lib/queries";
import { HubSetupCard } from "./Settings";

export function Dashboard() {
  const q = useDashboard();
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const { stats, upcoming, hub } = q.data;

  return (
    <>
      <PageHeader
        title={hub?.hubName ? `${hub.hubName}` : "Hub dashboard"}
        subtitle="Tender readiness across all the SMMEs your hub supports."
        actions={
          <Link to="/clients?new=1" className="btn-primary">
            <Plus className="h-4 w-4" /> Add SMME client
          </Link>
        }
      />
      {!hub?.hubName && <HubSetupCard />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile label="SMME clients" value={stats.clients} icon={<Building2 className="h-4 w-4" />} tone="blue" />
        <StatTile label="Active tenders" value={stats.activeTenders} icon={<FileStack className="h-4 w-4" />} tone="blue" />
        <StatTile
          label="Closing in 7 days"
          value={stats.closingIn7Days}
          icon={<AlarmClock className="h-4 w-4" />}
          tone={stats.closingIn7Days ? "red" : "green"}
        />
        <StatTile
          label="Open mandatory items"
          value={stats.openMandatory}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats.openMandatory ? "amber" : "green"}
          hint="Required documents not yet ticked off"
        />
      </div>

      <section className="mt-8">
        <h2 className="title-rule mb-5 text-xl uppercase text-navy-900">Upcoming deadlines</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No active tenders yet"
            action={
              <Link to="/clients" className="btn-primary">
                Go to clients
              </Link>
            }
          >
            Add an SMME client, then upload a tender or RFQ PDF to generate its compliance checklist.
          </EmptyState>
        ) : (
          <div className="card divide-y divide-slate-100">
            {upcoming.map((u) => {
              const closing = closingLabel(u.closingDate);
              return (
                <Link
                  key={u.tenderId}
                  to={`/tenders/${u.tenderId}`}
                  className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy-900">{u.title ?? u.fileName}</p>
                    <p className="truncate text-sm text-slate-500">{u.clientName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:w-64 sm:justify-end">
                    {u.status === "READY" ? (
                      <>
                        <Badge tone={closing.tone}>{closing.text}</Badge>
                        {u.highRisks > 0 && (
                          <Badge tone="red">
                            <AlertTriangle className="h-3 w-3" />
                            {u.highRisks} high risk{u.highRisks === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <StatusBadge status={u.status} />
                    )}
                  </div>
                  <div className="sm:w-48">
                    {u.checklistProgress !== null ? (
                      <>
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>Checklist</span>
                          <span className="tabular-nums">{u.checklistProgress}%</span>
                        </div>
                        <ProgressBar value={u.checklistProgress} />
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">{u.closingDate ? formatDateTime(u.closingDate) : "Analysing…"}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Checklist % shows how many of the tender's requirements have been ticked off. It does not predict whether a bid will qualify or win.
        </p>
      </section>
    </>
  );
}
