import React from 'react';
import {
  CheckCircle2,
  Clock,
  KeyRound,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';

type StatusVariant =
  | 'Available'
  | 'Occupied'
  | 'Held'
  | 'Housekeeping'
  | 'Maintenance'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'Cancelled'
  | 'On Shift'
  | 'Off Duty'
  | 'On Leave'
  | 'Sent'
  | 'Archived'
  | 'Failed'
  | 'Skipped'
  | 'Delivered (SMTP)'
  | 'Archived Receipt (Local Dispatch)';

const STYLE_MAP: Record<string, string> = {
  Available: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CheckedOut: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'On Shift': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Sent: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Delivered (SMTP)': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Delivered (Gateway)': 'bg-emerald-50 text-emerald-800 border-emerald-200',

  Occupied: 'bg-blue-50 text-blue-800 border-blue-200',
  CheckedIn: 'bg-blue-50 text-blue-800 border-blue-200',
  Archived: 'bg-sky-50 text-sky-800 border-sky-200',
  'Archived Receipt (Local Dispatch)': 'bg-sky-50 text-sky-800 border-sky-200',
  'Archived Dispatch (Ready)': 'bg-sky-50 text-sky-800 border-sky-200',

  Held: 'bg-amber-50 text-amber-800 border-amber-200',
  Housekeeping: 'bg-amber-50 text-amber-800 border-amber-200',
  'On Leave': 'bg-amber-50 text-amber-800 border-amber-200',

  Maintenance: 'bg-rose-50 text-rose-800 border-rose-200',
  Cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
  Failed: 'bg-rose-50 text-rose-800 border-rose-200',

  'Off Duty': 'bg-slate-100 text-slate-700 border-slate-200',
  Skipped: 'bg-slate-100 text-slate-700 border-slate-200',
};

const LABEL_MAP: Record<string, string> = {
  CheckedIn: 'Checked In',
  CheckedOut: 'Checked Out',
  'Archived Receipt (Local Dispatch)': 'Email Archived',
  'Archived Dispatch (Ready)': 'SMS Ready',
};

export const StatusBadge: React.FC<{ status: StatusVariant | string }> = ({ status }) => {
  const classes = STYLE_MAP[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const label = LABEL_MAP[status] || status;

  const renderIcon = () => {
    switch (status) {
      case 'Available':
      case 'CheckedOut':
      case 'On Shift':
      case 'Sent':
      case 'Delivered (SMTP)':
      case 'Delivered (Gateway)':
        return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      case 'Occupied':
      case 'CheckedIn':
        return <KeyRound className="w-3.5 h-3.5 shrink-0" />;
      case 'Held':
      case 'On Leave':
        return <Clock className="w-3.5 h-3.5 shrink-0" />;
      case 'Housekeeping':
        return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
      case 'Maintenance':
        return <Wrench className="w-3.5 h-3.5 shrink-0" />;
      case 'Cancelled':
      case 'Failed':
        return <XCircle className="w-3.5 h-3.5 shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 ${classes}`}
    >
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
};
