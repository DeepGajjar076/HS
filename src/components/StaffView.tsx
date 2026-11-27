import React, { useState } from 'react';
import { CalendarDays, Edit3, Plus, Trash2, Users, X } from 'lucide-react';
import {
  ShiftCode,
  StaffMember,
  StaffRole,
  WeekDay,
} from '../types/hotel';
import { StatusBadge } from './StatusBadge';

interface StaffViewProps {
  staff: StaffMember[];
  onCreateStaff: (payload: Omit<StaffMember, 'id'>) => Promise<StaffMember>;
  onUpdateStaff: (id: string, payload: Partial<StaffMember>) => Promise<StaffMember>;
  onDeleteStaff: (id: string) => Promise<void>;
}

const ROLES: StaffRole[] = [
  'Front Desk Manager',
  'Receptionist',
  'Housekeeping Lead',
  'Room Attendant',
  'Chef / F&B',
  'Night Auditor',
  'Accountant',
];

const WEEK_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHIFT_CYCLE: ShiftCode[] = ['Morning', 'Afternoon', 'Night', 'Off'];

const SHIFT_CHIP_CLASS: Record<ShiftCode, string> = {
  Morning: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
  Afternoon: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
  Night: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100',
  Off: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
};

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  onCreateStaff,
  onUpdateStaff,
  onDeleteStaff,
}) => {
  const [subTab, setSubTab] = useState<'directory' | 'roster'>('directory');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('Receptionist');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<StaffMember['status']>('On Shift');
  const [defaultShift, setDefaultShift] = useState<StaffMember['defaultShift']>(
    'Morning (06:00–14:00)'
  );
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setRole('Receptionist');
    setMobile('');
    setEmail('');
    setStatus('On Shift');
    setDefaultShift('Morning (06:00–14:00)');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setName(member.name);
    setRole(member.role);
    setMobile(member.mobile);
    setEmail(member.email);
    setStatus(member.status);
    setDefaultShift(member.defaultShift);
    setNotes(member.notes);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const shiftTag: ShiftCode = defaultShift.startsWith('Morning')
        ? 'Morning'
        : defaultShift.startsWith('Afternoon')
          ? 'Afternoon'
          : 'Night';

      if (editing) {
        await onUpdateStaff(editing.id, {
          name: name.trim(),
          role,
          mobile: mobile.trim(),
          email: email.trim(),
          status,
          defaultShift,
          notes: notes.trim(),
        });
      } else {
        await onCreateStaff({
          name: name.trim(),
          role,
          mobile: mobile.trim(),
          email: email.trim(),
          status,
          defaultShift,
          schedule: {
            Mon: shiftTag,
            Tue: shiftTag,
            Wed: shiftTag,
            Thu: shiftTag,
            Fri: shiftTag,
            Sat: shiftTag,
            Sun: 'Off',
          },
          notes: notes.trim(),
          joinedAt: new Date().toISOString().slice(0, 10),
        });
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCycleDayShift = async (member: StaffMember, day: WeekDay) => {
    const current = member.schedule[day] || 'Off';
    const next = SHIFT_CYCLE[(SHIFT_CYCLE.indexOf(current) + 1) % SHIFT_CYCLE.length];
    await onUpdateStaff(member.id, {
      schedule: { ...member.schedule, [day]: next },
    });
  };

  const onShiftCount = staff.filter((s) => s.status === 'On Shift').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'directory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff & Roles ({staff.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('roster')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'roster'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Weekly Shift Schedule</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 tabular-nums">
            {onShiftCount} on shift now
          </span>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {subTab === 'directory' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 font-semibold">Staff Member</th>
                  <th className="py-3 px-4 font-semibold">Assigned Role</th>
                  <th className="py-3 px-4 font-semibold">Contact</th>
                  <th className="py-3 px-4 font-semibold">Primary Shift</th>
                  <th className="py-3 px-4 font-semibold">Duty Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{member.name}</div>
                      {member.notes && (
                        <div className="text-[11px] text-slate-500 max-w-xs truncate">
                          {member.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          onUpdateStaff(member.id, {
                            role: e.target.value as StaffRole,
                          })
                        }
                        className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white text-slate-800"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-900 tabular-nums">
                        {member.mobile || '—'}
                      </div>
                      <div className="text-slate-500">{member.email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums">
                      {member.defaultShift}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStaff(member.id, {
                            status:
                              member.status === 'On Shift'
                                ? 'Off Duty'
                                : member.status === 'Off Duty'
                                  ? 'On Leave'
                                  : 'On Shift',
                          })
                        }
                        title="Click to cycle duty status"
                      >
                        <StatusBadge status={member.status} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded"
                          title="Edit staff"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteStaff(member.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded"
                          title="Remove staff"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Click any day cell to cycle shift assignment (Morning 06–14 · Afternoon
              14–22 · Night 22–06 · Off).
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 font-semibold">Staff / Role</th>
                  {WEEK_DAYS.map((day) => (
                    <th key={day} className="py-3 px-3 font-semibold text-center">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{member.name}</div>
                      <div className="text-[11px] text-slate-500">{member.role}</div>
                    </td>
                    {WEEK_DAYS.map((day) => {
                      const shift = member.schedule[day] || 'Off';
                      return (
                        <td key={day} className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleCycleDayShift(member, day)}
                            className={`w-full px-2 py-1.5 text-[11px] font-medium rounded border transition-colors ${SHIFT_CHIP_CLASS[shift]}`}
                          >
                            {shift}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Primary Shift
                  </label>
                  <select
                    value={defaultShift}
                    onChange={(e) =>
                      setDefaultShift(
                        e.target.value as StaffMember['defaultShift']
                      )
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Morning (06:00–14:00)">
                      Morning (06:00–14:00)
                    </option>
                    <option value="Afternoon (14:00–22:00)">
                      Afternoon (14:00–22:00)
                    </option>
                    <option value="Night (22:00–06:00)">
                      Night (22:00–06:00)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Duty Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as StaffMember['status'])
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="On Shift">On Shift</option>
                    <option value="Off Duty">Off Duty</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Shift Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  {busy ? 'Saving...' : editing ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
