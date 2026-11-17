// components/dashboard/super-admin-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  HomeIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

interface NavTab {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const TABS: NavTab[] = [
  { name: 'Overview', href: '/dashboard/super-admin', icon: HomeIcon, exact: true },
  { name: 'Schools', href: '/dashboard/super-admin/schools', icon: BuildingOfficeIcon },
  { name: 'Admins', href: '/dashboard/super-admin/admins', icon: UserGroupIcon },
  { name: 'Analytics', href: '/dashboard/super-admin/analytics', icon: ChartBarIcon },
  { name: 'System Settings', href: '/dashboard/super-admin/settings', icon: CogIcon },
];

export function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Super Admin sections"
      className="max-w-7xl mx-auto px-4 lg:px-8"
    >
      <div className="flex items-center space-x-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {TABS.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + '/');

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                relative group flex items-center space-x-2 whitespace-nowrap
                px-4 py-3 text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              <tab.icon
                className={`h-4 w-4 transition-colors ${
                  isActive
                    ? 'text-emerald-400'
                    : 'text-gray-600 group-hover:text-gray-400'
                }`}
              />
              <span>{tab.name}</span>

              {isActive && (
                <motion.span
                  layoutId="super-admin-tab-indicator"
                  className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}