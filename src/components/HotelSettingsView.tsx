import React, { useState } from 'react';
import {
  Building2,
  Check,
  FileText,
  MapPin,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { GstSettings } from '../types/hotel';

interface HotelSettingsViewProps {
  gstSettings: GstSettings;
  smtpConfigured: boolean;
  smsConfigured: boolean;
  onUpdateGstSettings: (payload: Partial<GstSettings>) => Promise<GstSettings>;
}

export const HotelSettingsView: React.FC<HotelSettingsViewProps> = ({
  gstSettings,
  smtpConfigured,
  smsConfigured,
  onUpdateGstSettings,
}) => {
  const [form, setForm] = useState<GstSettings>(gstSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await onUpdateGstSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs">
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Hotel Profile, GST Registration, Address & Policy
            </h2>
            <p className="text-slate-500 mt-0.5">
              Changes saved here automatically update all A4 tax invoices, automated
              guest mobile invoices, email receipts, and the workspace header.
            </p>
          </div>
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
              <Check className="w-3.5 h-3.5" />
              <span>Hotel Profile & Policy Saved</span>
            </span>
          )}
        </div>

        {/* 1. Hotel Identity & Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Building2 className="w-3.5 h-3.5" />
            <span>Hotel Name & Contact Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Hotel Display Name *
              </label>
              <input
                type="text"
                required
                value={form.hotelTradeName}
                onChange={(e) =>
                  setForm({ ...form, hotelTradeName: e.target.value })
                }
                placeholder="Hotel Shiv Residency"
                className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Registered Legal Name
              </label>
              <input
                type="text"
                value={form.hotelLegalName}
                onChange={(e) =>
                  setForm({ ...form, hotelLegalName: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Front Desk Phone
              </label>
              <input
                type="tel"
                value={form.hotelPhone}
                onChange={(e) => setForm({ ...form, hotelPhone: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Official Billing Email
              </label>
              <input
                type="email"
                value={form.hotelEmail}
                onChange={(e) => setForm({ ...form, hotelEmail: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 2. GST Number & Tax Registration */}
        <div className="pt-5 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>GST Number & Statutory Codes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Hotel GST Number (GSTIN)
              </label>
              <input
                type="text"
                maxLength={15}
                value={form.hotelGstNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hotelGstNumber: e.target.value.toUpperCase(),
                  })
                }
                placeholder="27AABCS7492R1Z3"
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                PAN Number
              </label>
              <input
                type="text"
                maxLength={10}
                value={form.hotelPan}
                onChange={(e) =>
                  setForm({ ...form, hotelPan: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                State & Code
              </label>
              <input
                type="text"
                value={form.hotelStateCode}
                onChange={(e) =>
                  setForm({ ...form, hotelStateCode: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Room SAC Code
              </label>
              <input
                type="text"
                value={form.roomSacCode}
                onChange={(e) =>
                  setForm({ ...form, roomSacCode: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                F&B SAC Code
              </label>
              <input
                type="text"
                value={form.foodSacCode}
                onChange={(e) =>
                  setForm({ ...form, foodSacCode: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 3. Hotel Address */}
        <div className="pt-5 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>Hotel Property Address</span>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Full Property Address (Printed on Invoices & Receipts)
            </label>
            <textarea
              rows={2}
              value={form.hotelAddress}
              onChange={(e) => setForm({ ...form, hotelAddress: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
        </div>

        {/* 4. Hotel Policy */}
        <div className="pt-5 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <FileText className="w-3.5 h-3.5" />
            <span>Hotel Policy & Check-In / Check-Out Rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Standard Check-In Time
              </label>
              <input
                type="text"
                value={form.checkInPolicyTime || '12:00 PM'}
                onChange={(e) =>
                  setForm({ ...form, checkInPolicyTime: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Standard Check-Out Time
              </label>
              <input
                type="text"
                value={form.checkOutPolicyTime || '10:00 AM'}
                onChange={(e) =>
                  setForm({ ...form, checkOutPolicyTime: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Hotel Guest & Cancellation Policy
            </label>
            <textarea
              rows={5}
              value={form.hotelPolicy || ''}
              onChange={(e) => setForm({ ...form, hotelPolicy: e.target.value })}
              placeholder="Enter check-in ID rules, cancellation terms, hold policy, and guest guidelines..."
              className="w-full px-3 py-2 text-sm leading-relaxed border border-slate-300 rounded-md"
            />
          </div>
        </div>

        {/* 5. Automated Mobile & Email Invoice Sending */}
        <div className="pt-5 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Automated Mobile & Email Invoice Dispatch</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoSmsReceipts}
                onChange={(e) =>
                  setForm({ ...form, autoSmsReceipts: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-slate-900 block">
                  Auto-Send Invoice to Guest Mobile
                </span>
                <span className="text-[11px] text-slate-500">
                  Automatically sends invoice summary & A4 view link on checkout (
                  {smsConfigured ? 'Live SMS Gateway' : 'Archived + WhatsApp Ready'}).
                </span>
              </span>
            </label>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Mobile Dispatch Channel
              </label>
              <select
                value={form.mobileDispatchChannel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mobileDispatchChannel: e.target.value as GstSettings['mobileDispatchChannel'],
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="SMS">SMS to Guest Mobile</option>
                <option value="WhatsApp">WhatsApp to Guest Mobile</option>
                <option value="Both">Both SMS & WhatsApp</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoEmailReceipts}
                onChange={(e) =>
                  setForm({ ...form, autoEmailReceipts: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-slate-900 block">
                  Auto-Send Email Receipts
                </span>
                <span className="text-[11px] text-slate-500">
                  Automatically emails themed invoice on checkout (
                  {smtpConfigured ? 'SMTP Active' : 'Archived Local Dispatch'}).
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving Changes...' : 'Save Hotel Profile & Policy'}
          </button>
        </div>
      </div>
    </form>
  );
};
