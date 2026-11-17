// components/super-admin/schools-table.tsx
'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { toggleSchoolStatus } from '@/actions/admin';
import { SchoolFormModal } from './school-form-modal';
import type { Database } from '@/types/zeis';

type School = Database['public']['Tables']['schools']['Row'];

interface Props {
  initialSchools: School[];
}

export function SchoolsTable({ initialSchools }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isPending, startTransition] = useTransition();
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  // Action dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const filteredSchools = useMemo(() => {
    return initialSchools.filter((school) => {
      // Search filter
      const matchesSearch = 
        school.name.toLowerCase().includes(search.toLowerCase()) ||
        school.slug.toLowerCase().includes(search.toLowerCase());
      
      // Status filter
      const matchesStatus = 
        filter === 'all' ? true :
        filter === 'active' ? school.is_active :
        !school.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [initialSchools, search, filter]);

  const handleToggleStatus = (school: School) => {
    setOpenDropdownId(null);
    startTransition(async () => {
      try {
        await toggleSchoolStatus({ id: school.id, is_active: !school.is_active });
      } catch (error) {
        alert('Failed to update status');
      }
    });
  };

  const handleEdit = (school: School) => {
    setEditingSchool(school);
    setIsModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleCreateNew = () => {
    setEditingSchool(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <FunnelIcon className="h-4 w-4" />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white appearance-none focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Register School</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/60 bg-gray-900/80 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4 font-medium">School</th>
                <th className="px-6 py-4 font-medium">Slug</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={isPending ? 'opacity-50 pointer-events-none' : ''}>
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No schools found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const logoUrl = (school.branding as Record<string, any>)?.logo_url;
                  
                  return (
                    <tr key={school.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-9 w-9 rounded bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logoUrl} alt={school.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-emerald-500 font-bold text-lg">{school.name.charAt(0)}</span>
                            )}
                          </div>
                          <span className="font-medium text-gray-200">{school.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">
                        /{school.slug}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          school.is_active 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${school.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {school.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(school.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right relative">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === school.id ? null : school.id)}
                          className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white"
                        >
                          <EllipsisHorizontalIcon className="h-5 w-5" />
                        </button>

                        {/* Dropdown */}
                        <AnimatePresence>
                          {openDropdownId === school.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setOpenDropdownId(null)} 
                              />
                              <motion.div
                                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                className="absolute right-8 top-10 z-20 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden py-1"
                              >
                                <button
                                  onClick={() => handleEdit(school)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center space-x-2"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                  <span>Edit Settings</span>
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(school)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center space-x-2"
                                >
                                  {school.is_active ? (
                                    <>
                                      <XCircleIcon className="h-4 w-4 text-red-400" />
                                      <span className="text-red-400">Suspend School</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                                      <span className="text-emerald-400">Activate School</span>
                                    </>
                                  )}
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <SchoolFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingSchool}
      />
    </div>
  );
}