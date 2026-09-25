import React from 'react';
import type { OrderStatus } from '@/lib/ipc';

const STATUS_CONFIG: Record<OrderStatus, { label: string; text: string; bg: string; border: string; icon: React.ReactNode }> = {
  OPEN: {
    label: "NEW",
    text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30",
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  SENT_TO_KITCHEN: {
    label: "PREPARING",
    text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30",
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  READY: {
    label: "READY",
    text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  },
  DELIVERED: {
    label: "DELIVERED",
    text: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30",
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    )
  },
  COMPLETED: {
    label: "COMPLETED",
    text: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30",
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  VOIDED: {
    label: "VOIDED",
    text: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30",
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    )
  },
};

export default function OrderStatusBadge({ status, className = "" }: { status: OrderStatus; className?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[9px] font-bold px-2 py-1 rounded tracking-widest leading-none border ${config.text} ${config.bg} ${config.border} ${className}`}
      aria-label={`Order status: ${config.label}`}
      role="status"
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}
