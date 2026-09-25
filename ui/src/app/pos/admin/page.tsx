"use client";
import { useDashboardReport } from "@/lib/queries";
import { usePosStore } from "@/lib/store";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function centsToDisplay(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export default function AdminDashboardPage() {
  const { data: report, isLoading } = useDashboardReport();
  const jwt = usePosStore((s) => s.jwt);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted">
        <span className="font-mono tracking-widest text-sm font-bold">ERROR LOADING DASHBOARD</span>
      </div>
    );
  }

  const { today, trend, topItems } = report;

  const handleExport = () => {
    // We can open the export URL directly, relying on the fact it's an API route.
    // However, it requires the JWT in the headers. Browsers won't send the JWT via simple window.open.
    // So we fetch it and download it via a Blob.
    fetch("http://localhost:4000/admin/reports/export", {
      headers: { Authorization: `Bearer ${jwt}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(console.error);
  };

  // Format trend data for chart
  const chartData = trend.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString("en-US", { weekday: "short" }),
    revenue: t.total / 100
  }));

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-y-auto scrollable p-6 md:p-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-up">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Analytics Overview</h1>
          <p className="text-muted font-mono text-xs tracking-widest uppercase">Today's Performance</p>
        </div>
        <button 
          onClick={handleExport}
          className="bg-surface-2 hover:bg-surface-3 border border-border px-6 py-3 rounded-xl font-mono text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          EXPORT SALES CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fade-up" style={{ animationDelay: "100ms" }}>
        
        <div className="p-6 rounded-2xl bg-surface-1 border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-muted font-bold">REVENUE</span>
          <span className="text-4xl font-extrabold text-emerald-500">{centsToDisplay(today.revenue)}</span>
        </div>

        <div className="p-6 rounded-2xl bg-surface-1 border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-muted font-bold">ORDERS TODAY</span>
          <span className="text-4xl font-extrabold text-foreground">{today.orderCount}</span>
        </div>

        <div className="p-6 rounded-2xl bg-surface-1 border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-muted font-bold">AVG ORDER VALUE</span>
          <span className="text-4xl font-extrabold text-foreground">{centsToDisplay(today.averageOrderValue)}</span>
        </div>

        <div className="p-6 rounded-2xl bg-surface-1 border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-amber-500">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" /></svg>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-muted font-bold">ACTIVE ORDERS</span>
          <span className="text-4xl font-extrabold text-amber-500">{today.activeOrders}</span>
        </div>

      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 fade-up" style={{ animationDelay: "200ms" }}>
        
        {/* Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-surface-1 border border-border shadow-sm flex flex-col">
          <h3 className="font-mono text-xs font-bold tracking-widest text-muted mb-8">7-DAY REVENUE TREND</h3>
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Items */}
        <div className="p-6 rounded-3xl bg-surface-1 border border-border shadow-sm flex flex-col">
          <h3 className="font-mono text-xs font-bold tracking-widest text-muted mb-6">TOP 5 ITEMS SOLD TODAY</h3>
          <div className="flex-1 flex flex-col gap-4">
            {topItems.length > 0 ? topItems.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-surface-2 border border-border/50 hover:border-border transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-mono text-xs font-bold text-muted">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{item.name}</p>
                    <p className="font-mono text-[10px] text-muted">{item.qty} units sold</p>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-emerald-500">
                  {centsToDisplay(item.revenue)}
                </div>
              </div>
            )) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <svg className="w-12 h-12 text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-mono text-xs tracking-widest text-muted">NO SALES YET</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
