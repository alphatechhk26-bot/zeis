'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  createPlatformUser,
  deletePlatformUser,
  revokeUserRole,
  updatePlatformUser,
} from '@/actions/super-admin-admins';
import type {
  CreatePlatformUserInput,
  PlatformSchool,
  PlatformUser,
  PlatformUserRole,
  UpdatePlatformUserInput,
} from '@/types/platform-users';
import { platformUserRoles } from '@/types/platform-users';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type UserForm = Omit<CreatePlatformUserInput, 'password'> & { password?: string };
type ModalState = { mode: 'add' } | { mode: 'edit'; user: PlatformUser } | null;
type Confirmation =
  | { action: 'revoke'; user: PlatformUser }
  | { action: 'delete'; user: PlatformUser }
  | null;

const ROLE_LABELS: Record<PlatformUserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

const ROLE_STYLES: Record<PlatformUserRole, string> = {
  super_admin: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  admin: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  teacher: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  student: 'border-gray-600 bg-gray-500/10 text-gray-300',
  parent: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

const EMPTY_FORM: UserForm = {
  fullName: '',
  email: '',
  role: 'admin',
  schoolId: null,
};

function isSuccessful<T>(result: ActionResult<T>): T {
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString();
}

export function AdminsTable({
  admins: initialUsers,
  schools,
  currentUserId,
}: {
  admins: PlatformUser[];
  schools: PlatformSchool[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<PlatformUserRole | 'all'>('all');
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesSearch =
        !query ||
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const counts = useMemo(
    () => ({
      total: users.length,
      superAdmins: users.filter((user) => user.role === 'super_admin').length,
      admins: users.filter((user) => user.role === 'admin').length,
      teachers: users.filter((user) => user.role === 'teacher').length,
      studentsAndParents: users.filter(
        (user) => user.role === 'student' || user.role === 'parent'
      ).length,
    }),
    [users]
  );

  const schoolName = (schoolId: string | null) =>
    schoolId ? schools.find((school) => school.id === schoolId)?.name ?? null : null;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setErrorMessage(null);
    setModal({ mode: 'add' });
  };

  const openEdit = (user: PlatformUser) => {
    setForm({
      fullName: user.full_name ?? '',
      email: user.email ?? '',
      role: user.role ?? 'student',
      schoolId: user.school_id,
    });
    setErrorMessage(null);
    setModal({ mode: 'edit', user });
  };

  const saveUpdate = async (input: UpdatePlatformUserInput) => {
    isSuccessful(await updatePlatformUser(input));
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const changedEmail = users.find((user) => user.id === input.userId)?.email !== email;
    setUsers((current) =>
      current.map((user) =>
        user.id === input.userId
          ? {
              ...user,
              email,
              full_name: fullName,
              role: input.role,
              school_id: input.schoolId,
              school_name: schoolName(input.schoolId),
              email_confirmed_at: changedEmail
                ? new Date().toISOString()
                : user.email_confirmed_at,
              status: changedEmail ? 'email_verified' : user.status,
            }
          : user
      )
    );
  };

  const handleInlineUpdate = async (
    user: PlatformUser,
    role: PlatformUserRole,
    schoolId: string | null
  ) => {
    if (!user.email) {
      setErrorMessage('This account has no email address. Edit the user and add an email first.');
      return;
    }
    if (!user.full_name?.trim()) {
      setErrorMessage('This account has no full name. Edit the user and add a name first.');
      return;
    }
    setErrorMessage(null);
    setNotice(null);
    setBusyUserId(user.id);
    try {
      await saveUpdate({
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        role,
        schoolId,
      });
      setNotice(`${user.full_name} updated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update the user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      if (modal?.mode === 'add') {
        const password = form.password ?? '';
        const created = isSuccessful(
          await createPlatformUser({
            email: form.email,
            password,
            fullName: form.fullName,
            role: form.role,
            schoolId: form.schoolId,
          })
        );
        const createdAt = new Date().toISOString();
        setUsers((current) => [
          {
            id: created.id,
            email: form.email.trim().toLowerCase(),
            full_name: form.fullName.trim(),
            role: form.role,
            school_id: form.schoolId,
            school_name: schoolName(form.schoolId),
            created_at: createdAt,
            last_sign_in_at: null,
            email_confirmed_at: createdAt,
            status: 'email_verified',
          },
          ...current,
        ]);
        setNotice('User created successfully.');
      } else if (modal?.mode === 'edit') {
        await saveUpdate({
          userId: modal.user.id,
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          schoolId: form.schoolId,
        });
        setNotice('User updated successfully.');
      }
      setModal(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the user.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmation = async () => {
    if (!confirmation) return;
    const target = confirmation.user;
    const action = confirmation.action;
    setBusyUserId(target.id);
    setErrorMessage(null);
    setNotice(null);
    try {
      if (action === 'revoke') {
        isSuccessful(await revokeUserRole({ userId: target.id }));
        setUsers((current) =>
          current.map((user) =>
            user.id === target.id
              ? { ...user, role: 'student', school_id: null, school_name: null }
              : user
          )
        );
        setNotice(`${target.full_name ?? target.email ?? 'User'} role revoked.`);
      } else {
        isSuccessful(await deletePlatformUser({ userId: target.id }));
        setUsers((current) => current.filter((user) => user.id !== target.id));
        setNotice(`${target.full_name ?? target.email ?? 'User'} deleted.`);
      }
      setConfirmation(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The operation failed.');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total Users', counts.total, 'text-cyan-300', 'border-cyan-500/20'],
          ['Super Admins', counts.superAdmins, 'text-emerald-300', 'border-emerald-500/20'],
          ['Admins', counts.admins, 'text-blue-300', 'border-blue-500/20'],
          ['Teachers', counts.teachers, 'text-purple-300', 'border-purple-500/20'],
          ['Students & Parents', counts.studentsAndParents, 'text-amber-300', 'border-amber-500/20'],
        ].map(([label, count, accent, border]) => (
          <div
            key={label}
            className={`rounded-xl border bg-gray-900/60 p-4 shadow-[0_0_18px_rgba(15,23,42,0.25)] ${border}`}
          >
            <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
            <div className={`mt-2 text-3xl font-bold ${accent}`}>{count}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Search users by name or email</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email..."
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 py-2.5 pl-9 pr-3 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400"
          >
            + Add User
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter users by role">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              roleFilter === 'all'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            All
          </button>
          {platformUserRoles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                roleFilter === role
                  ? ROLE_STYLES[role]
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>

      {(errorMessage || notice) && (
        <div
          role={errorMessage ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-sm ${
            errorMessage
              ? 'border-red-500/30 bg-red-950/40 text-red-200'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
          }`}
        >
          {errorMessage ?? notice}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b border-gray-800/60 bg-gray-900/80 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Email status</th>
                <th className="px-4 py-3 font-medium">Last sign in</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    {users.length ? 'No users match these filters.' : 'No platform users found.'}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isBusy = busyUserId === user.id;
                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-gray-800/40 last:border-0 hover:bg-gray-900/60 ${
                        isBusy ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                            {(user.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-200">
                              {user.full_name ?? 'No name'}
                              {isSelf && (
                                <span className="ml-2 font-mono text-[10px] uppercase text-emerald-400">
                                  you
                                </span>
                              )}
                            </div>
                            <div className="truncate font-mono text-[11px] text-gray-500">
                              {user.email ?? 'No email'}
                            </div>
                            <div className="text-[11px] text-gray-600">
                              Joined {formatDate(user.created_at)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Role for ${user.full_name ?? user.email ?? 'user'}`}
                          value={user.role ?? ''}
                          disabled={isBusy || isSelf}
                          onFocus={() => setErrorMessage(null)}
                          onChange={(event) => {
                            const role = event.target.value as PlatformUserRole;
                            void handleInlineUpdate(
                              user,
                              role,
                              role === 'super_admin' ? null : user.school_id
                            );
                          }}
                          className={`max-w-36 rounded-md border bg-gray-950/50 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed ${
                            user.role ? ROLE_STYLES[user.role] : 'border-gray-700 text-gray-400'
                          }`}
                        >
                          {!user.role && <option value="">No role</option>}
                          {platformUserRoles.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {user.role === 'super_admin' ? (
                          <span className="text-xs italic text-gray-500">— platform —</span>
                        ) : (
                          <select
                            aria-label={`School for ${user.full_name ?? user.email ?? 'user'}`}
                            value={user.school_id ?? ''}
                            disabled={isBusy || !user.role}
                            onFocus={() => setErrorMessage(null)}
                            onChange={(event) => {
                              if (user.role) {
                                void handleInlineUpdate(user, user.role, event.target.value || null);
                              }
                            }}
                            className="max-w-48 rounded-md border border-gray-700 bg-gray-800/60 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed"
                          >
                            <option value="">— platform —</option>
                            {schools.map((school) => (
                              <option key={school.id} value={school.id}>
                                {school.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] ${
                            user.status === 'email_verified'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          {user.status === 'email_verified'
                            ? 'Confirmed'
                            : user.status === 'no_email'
                              ? 'No email'
                              : 'Unconfirmed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDate(user.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            disabled={isBusy}
                            className="text-xs text-emerald-300 transition hover:text-emerald-200 disabled:text-gray-600"
                          >
                            Edit
                          </button>
                          {user.role === 'admin' || user.role === 'super_admin' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setConfirmation({ action: 'revoke', user });
                              }}
                              disabled={isBusy || isSelf}
                              className="text-xs text-amber-300 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:text-gray-600"
                            >
                              Revoke
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage(null);
                              setConfirmation({ action: 'delete', user });
                            }}
                            disabled={isBusy || isSelf}
                            className="text-xs text-red-400 transition hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-800/60 px-4 py-3 text-xs text-gray-500">
          Showing {visibleUsers.length} of {users.length} users
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setModal(null);
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg space-y-5 rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
          >
            <div>
              <h3 className="text-lg font-semibold text-white">
                {modal.mode === 'add' ? 'Add platform user' : 'Edit user'}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {modal.mode === 'add'
                  ? 'Create a user account and assign a platform role.'
                  : 'Update account details, access role, and school assignment.'}
              </p>
            </div>

            <label className="block space-y-1.5 text-sm text-gray-300">
              <span>Full Name</span>
              <input
                required
                maxLength={255}
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2.5 text-gray-100 outline-none focus:border-emerald-500/60"
              />
            </label>
            <label className="block space-y-1.5 text-sm text-gray-300">
              <span>Email</span>
              <input
                required
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2.5 text-gray-100 outline-none focus:border-emerald-500/60"
              />
            </label>
            {modal.mode === 'add' && (
              <label className="block space-y-1.5 text-sm text-gray-300">
                <span>Password</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password ?? ''}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2.5 text-gray-100 outline-none focus:border-emerald-500/60"
                />
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm text-gray-300">
                <span>Role</span>
                <select
                  required
                  value={form.role}
                  disabled={modal.mode === 'edit' && modal.user.id === currentUserId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value as PlatformUserRole,
                      schoolId: event.target.value === 'super_admin' ? null : form.schoolId,
                    })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2.5 text-gray-100 outline-none focus:border-emerald-500/60"
                >
                  {platformUserRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm text-gray-300">
                <span>School</span>
                <select
                  value={form.schoolId ?? ''}
                  disabled={form.role === 'super_admin'}
                  onChange={(event) =>
                    setForm({ ...form, schoolId: event.target.value || null })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2.5 text-gray-100 outline-none focus:border-emerald-500/60"
                >
                  <option value="">— platform —</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {errorMessage && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-gray-800 pt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={saving}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Create user' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="user-confirm-title"
            className="w-full max-w-md space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
          >
            <h3 id="user-confirm-title" className="text-lg font-semibold text-white">
              {confirmation.action === 'revoke' ? 'Revoke admin access?' : 'Delete this user?'}
            </h3>
            <p className="text-sm text-gray-400">
              {confirmation.action === 'revoke' ? (
                <>
                  {confirmation.user.full_name ?? confirmation.user.email} will be changed to{' '}
                  <span className="font-mono text-gray-200">student</span> and the school
                  assignment will be cleared.
                </>
              ) : (
                <>
                  Permanently delete{' '}
                  <span className="font-medium text-gray-200">
                    {confirmation.user.full_name ?? confirmation.user.email}
                  </span>
                  ? Related records may prevent deletion.
                </>
              )}
            </p>
            {errorMessage && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                disabled={busyUserId !== null}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmation()}
                disabled={busyUserId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-wait disabled:opacity-60"
              >
                {busyUserId ? 'Working…' : confirmation.action === 'revoke' ? 'Yes, revoke' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
