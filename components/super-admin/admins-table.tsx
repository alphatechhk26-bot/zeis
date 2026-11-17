// components/super-admin/admins-table.tsx
'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/zeis';
import {
  updateAdminRole,
  assignAdminSchool,
  revokeAdminAccess,
} from '@/actions/super-admin-admins';

type UserRole = Database['public']['Enums']['user_role'];

export interface AdminRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  school_id: string | null;
  school_name: string | null;
  school_slug: string | null;
  school_active: boolean | null;
  created_at: string;
}

interface Props {
  admins: AdminRow[];
  schools: { id: string; name: string; slug: string }[];
  currentUserId: string;
}

const ROLE_STYLES: Record<UserRole, string> = {
  super_admin: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  admin: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  teacher: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  student: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  parent: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

function deriveStatus(admin: AdminRow): 'active' | 'inactive' | 'unassigned' {
  if (admin.role === 'super_admin') return 'active';
  if (!admin.school_id) return 'unassigned';
  if (admin.school_active === false) return 'inactive';
  return 'active';
}

const STATUS_STYLES = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-red-500/10 text-red-400 border-red-500/30',
  unassigned: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

export function AdminsTable({ admins, schools, currentUserId }: Props) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ admin: AdminRow } | null>(null);

  const showToast = (kind: 'error' | 'success', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRoleChange = (admin: AdminRow, newRole: UserRole) => {
    if (newRole === admin.role) return;
    setBusyId(admin.id);
    startTransition(async () => {
      try {
        await updateAdminRole({ userId: admin.id, newRole });
        showToast('success', `${admin.full_name ?? 'User'} → ${newRole.replace('_', ' ')}`);
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Update failed');
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleSchoolChange = (admin: AdminRow, schoolId: string) => {
    const target = schoolId || null;
    if (target === admin.school_id) return;
    setBusyId(admin.id);
    startTransition(async () => {
      try {
        await assignAdminSchool({ userId: admin.id, schoolId: target });
        showToast('success', target ? 'School assigned' : 'School removed');
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Assignment failed');
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleRevoke = () => {
    if (!confirm) return;
    const target = confirm.admin;
    setConfirm(null);
    setBusyId(target.id);
    startTransition(async () => {
      try {
        await revokeAdminAccess({ userId: target.id });
        showToast('success', `${target.full_name ?? 'User'} downgraded to student`);
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Revoke failed');
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm max-w-sm shadow-xl ${
              toast.kind === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-200'
                : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/60 bg-gray-900/80 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No administrators found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const status = deriveStatus(admin);
                  const isSelf = admin.id === currentUserId;
                  const isBusy = busyId === admin.id && pending;

                  return (
                    <tr
                      key={admin.id}
                      className={`border-b border-gray-800/40 last:border-0 hover:bg-gray-900/60 ${
                        isBusy ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(admin.full_name?.[0] ?? admin.email?.[0] ?? '?').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-gray-200 font-medium truncate">
                              {admin.full_name ?? '—'}
                              {isSelf && (
                                <span className="ml-2 text-[10px] text-emerald-400 font-mono uppercase">
                                  you
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Joined {new Date(admin.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {admin.email ?? '—'}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <select
                          value={admin.role}
                          disabled={isBusy || isSelf}
                          onChange={(e) => handleRoleChange(admin, e.target.value as UserRole)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed ${ROLE_STYLES[admin.role]}`}
                        >
                          <option value="super_admin">super_admin</option>
                          <option value="admin">admin</option>
                          <option value="teacher">teacher</option>
                          <option value="student">student</option>
                          <option value="parent">parent</option>
                        </select>
                      </td>

                      {/* School */}
                      <td className="px-4 py-3">
                        {admin.role === 'super_admin' ? (
                          <span className="text-xs text-gray-600 italic">— platform —</span>
                        ) : (
                          <select
                            value={admin.school_id ?? ''}
                            disabled={isBusy}
                            onChange={(e) => handleSchoolChange(admin, e.target.value)}
                            className="px-2.5 py-1 rounded-md text-xs border border-gray-700 bg-gray-800/60 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 max-w-[180px] disabled:cursor-not-allowed"
                          >
                            <option value="">— unassigned —</option>
                            {schools.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLES[status]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5" />
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfirm({ admin })}
                          disabled={isBusy || isSelf}
                          className="text-xs text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-white">Revoke admin access?</h3>
              <p className="text-sm text-gray-400">
                <span className="text-gray-200 font-medium">
                  {confirm.admin.full_name ?? confirm.admin.email}
                </span>{' '}
                will be downgraded to <span className="font-mono text-gray-200">student</span> and
                their school assignment will be cleared. This cannot be undone.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 text-sm rounded-md border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevoke}
                  className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Yes, revoke
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}