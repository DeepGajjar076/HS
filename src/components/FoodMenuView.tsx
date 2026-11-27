import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Booking,
  FoodCategory,
  FoodItem,
  GstSettings,
  Guest,
  Room,
} from '../types/hotel';
import { formatCurrency } from '../utils/billing';

interface FoodMenuViewProps {
  foodMenu: FoodItem[];
  bookings: Booking[];
  rooms: Room[];
  guests: Guest[];
  gstSettings: GstSettings;
  onCreateFoodItem: (payload: Omit<FoodItem, 'id'>) => Promise<FoodItem>;
  onUpdateFoodItem: (id: string, payload: Partial<FoodItem>) => Promise<FoodItem>;
  onDeleteFoodItem: (id: string) => Promise<void>;
  onAddFoodOrder: (bookingId: string, foodItemId: string, quantity: number) => Promise<void>;
  onOpenFoodBill?: () => void;
}

const CATEGORIES: FoodCategory[] = [
  'Breakfast',
  'Main Course',
  'Snacks',
  'Beverages',
  'Desserts',
];

export const FoodMenuView: React.FC<FoodMenuViewProps> = ({
  foodMenu,
  bookings,
  rooms,
  guests,
  gstSettings,
  onCreateFoodItem,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onAddFoodOrder,
  onOpenFoodBill,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | FoodCategory>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Main Course');
  const [rate, setRate] = useState('350');
  const [gstRate, setGstRate] = useState('5');
  const [isVeg, setIsVeg] = useState(true);
  const [available, setAvailable] = useState(true);
  const [description, setDescription] = useState('');

  // Quick Room Service Order Dispatcher
  const activeCheckIns = useMemo(
    () => bookings.filter((b) => b.status === 'CheckedIn'),
    [bookings]
  );
  const [targetBookingId, setTargetBookingId] = useState(
    activeCheckIns[0]?.id || ''
  );
  const [orderNotice, setOrderNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const sym = gstSettings.currencySymbol || '₹';

  const filteredItems = foodMenu.filter((item) =>
    categoryFilter === 'all' ? true : item.category === categoryFilter
  );

  const openAdd = () => {
    setEditingItem(null);
    setName('');
    setCategory('Main Course');
    setRate('350');
    setGstRate('5');
    setIsVeg(true);
    setAvailable(true);
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (item: FoodItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setRate(String(item.rate));
    setGstRate(String(item.gstRate));
    setIsVeg(item.isVeg);
    setAvailable(item.available);
    setDescription(item.description);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload: Omit<FoodItem, 'id'> = {
        name: name.trim(),
        category,
        rate: Math.max(0, Number(rate) || 0),
        gstRate: Math.max(0, Number(gstRate) || 0),
        isVeg,
        available,
        description: description.trim(),
      };
      if (editingItem) {
        await onUpdateFoodItem(editingItem.id, payload);
      } else {
        await onCreateFoodItem(payload);
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleQuickPostToRoom = async (item: FoodItem) => {
    const bkId = targetBookingId || activeCheckIns[0]?.id;
    if (!bkId) return;
    setBusy(true);
    try {
      await onAddFoodOrder(bkId, item.id, 1);
      const bk = activeCheckIns.find((b) => b.id === bkId);
      const rm = rooms.find((r) => r.id === bk?.roomId);
      setOrderNotice(`Added ${item.name} to Room ${rm?.number || ''}`);
      setTimeout(() => setOrderNotice(''), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Categories + Room Service Quick Target + Add Item */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({foodMenu.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenFoodBill && (
            <button
              type="button"
              onClick={onOpenFoodBill}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ReceiptText className="w-3.5 h-3.5" />
              <span>Separate Food Bill</span>
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Food Item</span>
          </button>
        </div>
      </div>

      {/* Room Service Dispatch Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
            <span>Quick Room Service Target:</span>
          </span>
          {activeCheckIns.length > 0 ? (
            <select
              value={targetBookingId || activeCheckIns[0]?.id}
              onChange={(e) => setTargetBookingId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium text-slate-800"
            >
              {activeCheckIns.map((bk) => {
                const rm = rooms.find((r) => r.id === bk.roomId);
                const gs = guests.find((g) => g.id === bk.guestId);
                return (
                  <option key={bk.id} value={bk.id}>
                    Room {rm?.number} — {gs?.name} ({bk.foodOrders.length} items on folio)
                  </option>
                );
              })}
            </select>
          ) : (
            <span className="text-slate-500">
              No active checked-in rooms to post orders.
            </span>
          )}
        </div>
        {orderNotice && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <Check className="w-3.5 h-3.5" />
            <span>{orderNotice}</span>
          </span>
        )}
      </div>

      {/* Food Menu Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 font-semibold">Item & Description</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Dietary</th>
                <th className="py-3 px-4 font-semibold text-right">Rate</th>
                <th className="py-3 px-4 font-semibold text-right">GST %</th>
                <th className="py-3 px-4 font-semibold">Availability</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    {item.description && (
                      <div className="text-[11px] text-slate-500 max-w-md truncate">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{item.category}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${
                        item.isVeg
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {item.isVeg ? 'Veg' : 'Non-Veg'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {formatCurrency(item.rate, sym)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {gstSettings.gstEnabled
                      ? gstSettings.foodGstMode === 'uniform'
                        ? `${gstSettings.customFoodGstRate}%`
                        : `${item.gstRate}%`
                      : '0%'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateFoodItem(item.id, { available: !item.available })
                      }
                      className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                        item.available
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {item.available ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {activeCheckIns.length > 0 && item.available && (
                        <button
                          type="button"
                          onClick={() => handleQuickPostToRoom(item)}
                          disabled={busy}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                        >
                          + Room Order
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded"
                        title="Edit food item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteFoodItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded"
                        title="Delete food item"
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

      {/* Add / Edit Food Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingItem ? 'Edit Food Item' : 'Add Food Item'}
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
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FoodCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Rate ({sym}) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    GST %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={28}
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Dietary Type
                  </label>
                  <select
                    value={isVeg ? 'veg' : 'nonveg'}
                    onChange={(e) => setIsVeg(e.target.value === 'veg')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="nonveg">Non-Vegetarian</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                />
                <span className="text-slate-700 font-medium">
                  Available for room service ordering
                </span>
              </label>
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
                  {busy ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
