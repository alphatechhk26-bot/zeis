// components/super-admin/settings-form.tsx
'use client';

import { useActionState } from 'react';
import { updateSystemSettings, type SettingsState } from '@/actions/settings';
import type { Database } from '@/types/zeis';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ServerIcon,
  EnvelopeIcon,
  CogIcon
} from '@heroicons/react/24/outline';

type SystemSettings = Database['public']['Tables']['system_settings']['Row'];

interface Props {
  initialData: SystemSettings | null;
}

const initialState: SettingsState = {};

export function SettingsForm({ initialData }: Props) {
  const [state, formAction, isPending] = useActionState(updateSystemSettings, initialState);

  // Fallback defaults
  const data = initialData || {
    maintenance_mode: false,
    default_term: 'Term 1',
    email_notifications_enabled: true,
    smtp_host: 'smtp-relay.brevo.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
  };

  return (
    <form action={formAction} className="space-y-6">
      {/* Notifications */}
      {state?.error && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-900/50 flex items-start space-x-3 text-red-400">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-900/50 flex items-start space-x-3 text-emerald-400">
          <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">Settings updated successfully.</p>
        </div>
      )}

      {/* General Settings */}
      <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60 flex items-center space-x-2">
          <CogIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">General Platform Configuration</h3>
        </div>
        <div className="p-6 space-y-6">
          {/* Maintenance Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Maintenance Mode</p>
              <p className="text-xs text-gray-500 mt-1">When active, only super_admins can access the platform.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                name="maintenance_mode" 
                defaultChecked={data.maintenance_mode}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <hr className="border-gray-800/60" />

          {/* Default Academic Term */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Default Academic Term</label>
            <select
              name="default_term"
              defaultValue={data.default_term}
              className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>
        </div>
      </div>

      {/* Email Integration (Brevo) */}
      <div className="bg-gray-900/60 rounded-xl border border-gray-800/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60 flex items-center space-x-2">
          <EnvelopeIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Email Notifications (Brevo SMTP)</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Enable Email Notifications</p>
              <p className="text-xs text-gray-500 mt-1">Send transactional emails (invoices, invites, results).</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                name="email_notifications_enabled" 
                defaultChecked={data.email_notifications_enabled}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <hr className="border-gray-800/60" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">SMTP Host</label>
              <input
                type="text"
                name="smtp_host"
                defaultValue={data.smtp_host || ''}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">SMTP Port</label>
              <input
                type="number"
                name="smtp_port"
                defaultValue={data.smtp_port || 587}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">SMTP Username</label>
              <input
                type="text"
                name="smtp_user"
                defaultValue={data.smtp_user || ''}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">SMTP Password</label>
              <input
                type="password"
                name="smtp_password"
                placeholder={data.smtp_password ? '••••••••' : 'Enter password'}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving Settings...' : 'Save Configuration'}
        </button>
      </div>
    </form>
  );
}