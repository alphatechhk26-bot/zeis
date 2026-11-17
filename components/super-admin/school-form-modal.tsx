// components/super-admin/school-form-modal.tsx
'use client';

import { useState, useEffect, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { registerSchool, updateSchool } from '@/actions/admin';
import type { Database } from '@/types/zeis';

type School = Database['public']['Tables']['schools']['Row'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: School | null;
}

export function SchoolFormModal({ isOpen, onClose, initialData }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    logoUrl: '',
    is_active: true,
  });

  // Reset form when modal opens/closes or data changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const branding = (initialData.branding as Record<string, any>) || {};
        setFormData({
          name: initialData.name,
          slug: initialData.slug,
          logoUrl: branding.logo_url || '',
          is_active: initialData.is_active,
        });
      } else {
        setFormData({ name: '', slug: '', logoUrl: '', is_active: true });
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    // Auto-generate slug if creating new, or if user hasn't manually edited it
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setFormData((prev) => ({ ...prev, name, slug: initialData ? prev.slug : slug }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          name: formData.name,
          slug: formData.slug,
          is_active: formData.is_active,
          branding: { logo_url: formData.logoUrl },
        };

        if (initialData) {
          await updateSchool({ ...payload, id: initialData.id });
        } else {
          await registerSchool(payload);
        }
        onClose();
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
      }
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">
              {initialData ? 'Edit School Settings' : 'Register New School'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">School Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={handleNameChange}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="e.g. ZEIS Academy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Slug (URL)</label>
              <input
                required
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="zeis-academy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Logo URL (Optional)</label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded bg-gray-950 border-gray-700 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-300">
                Active (visible to users)
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md disabled:opacity-50 flex items-center"
              >
                {isPending ? 'Saving...' : initialData ? 'Save Changes' : 'Create School'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}