import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { GstSettings, Room, RoomStatus, RoomType } from '../types/hotel';
import { formatCurrency, resolveRoomGstRate } from '../utils/billing';
import { StatusBadge } from './StatusBadge';

interface RoomsViewProps {
  rooms: Room[];
  gstSettings: GstSettings;
  onCreateRoom: (payload: Omit<Room, 'id'>) => Promise<Room>;
  onUpdateRoom: (id: string, payload: Partial<Room>) => Promise<Room>;
  onDeleteRoom: (id: string) => Promise<void>;
}

const ROOM_TYPES: RoomType[] = [
  'Deluxe Room',
  'Super Deluxe Room',
  'Family Room',
];

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  gstSettings,
  onCreateRoom,
  onUpdateRoom,
  onDeleteRoom,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | RoomType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState(1);
  const [type, setType] = useState<RoomType>('Deluxe Room');
  const [rate, setRate] = useState('3500');
  const [maxOccupancy, setMaxOccupancy] = useState(2);
  const [amenitiesStr, setAmenitiesStr] = useState('Wi-Fi, Smart TV, Work Desk');
  const [status, setStatus] = useState<RoomStatus>('Available');
  const [gstOverride, setGstOverride] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sym = gstSettings.currencySymbol || '₹';

  const filteredRooms = useMemo(
    () =>
      rooms.filter((r) => (typeFilter === 'all' ? true : r.type === typeFilter)),
    [rooms, typeFilter]
  );

  const openAdd = () => {
    setEditingRoom(null);
    setNumber('');
    setFloor(1);
    setType('Deluxe Room');
    setRate('3500');
    setMaxOccupancy(2);
    setAmenitiesStr('Wi-Fi, Smart TV, Work Desk');
    setStatus('Available');
    setGstOverride('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (rm: Room) => {
    setEditingRoom(rm);
    setNumber(rm.number);
    setFloor(rm.floor);
    setType(rm.type);
    setRate(String(rm.rate));
    setMaxOccupancy(rm.maxOccupancy);
    setAmenitiesStr(rm.amenities.join(', '));
    setStatus(rm.status);
    setGstOverride(
      rm.gstRateOverride !== null && rm.gstRateOverride !== undefined
        ? String(rm.gstRateOverride)
        : ''
    );
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) {
      setError('Room number is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload: Omit<Room, 'id'> = {
        number: number.trim(),
        floor: Number(floor) || 1,
        type,
        rate: Math.max(0, Number(rate) || 0),
        maxOccupancy: Math.max(1, Number(maxOccupancy) || 2),
        amenities: amenitiesStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        status,
        gstRateOverride:
          gstOverride.trim() !== '' ? Math.max(0, Number(gstOverride)) : null,
      };
      if (editingRoom) {
        await onUpdateRoom(editingRoom.id, payload);
      } else {
        await onCreateRoom(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save room.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (rm: Room) => {
    setError('');
    try {
      await onDeleteRoom(rm.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete room.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              typeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Rooms ({rooms.length})
          </button>
          {ROOM_TYPES.map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => setTypeFilter(rt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === rt
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {rt}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Room</span>
        </button>
      </div>

      {error && !modalOpen && (
        <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 font-semibold">Room #</th>
                <th className="py-3 px-4 font-semibold">Category & Floor</th>
                <th className="py-3 px-4 font-semibold text-right">Nightly Rate</th>
                <th className="py-3 px-4 font-semibold text-right">Effective GST</th>
                <th className="py-3 px-4 font-semibold">Amenities</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRooms.map((rm) => {
                const effectiveGst = resolveRoomGstRate(
                  rm.rate,
                  gstSettings,
                  rm.gstRateOverride
                );
                const isOccupiedOrHeld =
                  rm.status === 'Occupied' || rm.status === 'Held';
                return (
                  <tr key={rm.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                      {rm.number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{rm.type}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        Floor {rm.floor} · Max {rm.maxOccupancy} guests
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatCurrency(rm.rate, sym)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {gstSettings.gstEnabled ? `${effectiveGst}%` : '0% (Off)'}
                      {rm.gstRateOverride !== null && rm.gstRateOverride !== undefined && (
                        <span className="block text-[10px] text-slate-400">
                          Room override
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {rm.amenities.join(' · ')}
                    </td>
                    <td className="py-3 px-4">
                      {isOccupiedOrHeld ? (
                        <StatusBadge status={rm.status} />
                      ) : (
                        <select
                          value={rm.status}
                          onChange={(e) =>
                            onUpdateRoom(rm.id, {
                              status: e.target.value as RoomStatus,
                            })
                          }
                          className="px-2 py-1 text-xs font-medium border border-slate-300 rounded bg-white text-slate-800"
                        >
                          <option value="Available">Available</option>
                          <option value="Housekeeping">Housekeeping</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(rm)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded"
                          title="Edit room"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rm)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded"
                          title="Delete room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Room Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingRoom ? `Edit Room ${editingRoom.number}` : 'Add New Room'}
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
              {error && (
                <div className="p-2.5 text-rose-800 bg-rose-50 border border-rose-200 rounded">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="e.g. 401"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Floor</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Room Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as RoomType)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nightly Rate ({sym})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Max Occupancy
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={maxOccupancy}
                    onChange={(e) => setMaxOccupancy(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Custom GST % Override (optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={28}
                    value={gstOverride}
                    onChange={(e) => setGstOverride(e.target.value)}
                    placeholder="Auto slab if blank"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Amenities (comma separated)
                </label>
                <input
                  type="text"
                  value={amenitiesStr}
                  onChange={(e) => setAmenitiesStr(e.target.value)}
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
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? 'Saving...' : editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
