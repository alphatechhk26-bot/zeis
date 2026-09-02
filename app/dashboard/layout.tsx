'use client';

import { AIProvider } from '@/contexts/AIContext';
import AITutorDrawer from '@/components/ai/AITutorDrawer';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import {
  HomeIcon,
  BookOpenIcon,
  CalendarIcon,
  UserGroupIcon,
  ChartBarIcon,
  AcademicCapIcon,
  CogIcon,
  BellIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  CreditCardIcon,
  DocumentTextIcon,
  CalculatorIcon,
  ComputerDesktopIcon,
  SparklesIcon,
  ArrowRightStartOnRectangleIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useDebounce } from 'use-debounce';

type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent';

// ---------------------------------------------------------------------------
// Navigation items per role
// ---------------------------------------------------------------------------
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  super_admin: [
    { name: 'Overview', href: '/dashboard/super-admin', icon: HomeIcon },
    { name: 'Schools', href: '/dashboard/super-admin/schools', icon: BuildingOfficeIcon },
    { name: 'Admins', href: '/dashboard/super-admin/admins', icon: UserGroupIcon },
    { name: 'Analytics', href: '/dashboard/super-admin/analytics', icon: ChartBarIcon },
    { name: 'System Settings', href: '/dashboard/super-admin/settings', icon: CogIcon },
  ],
  admin: [
    { name: 'Dashboard', href: '/dashboard/admin', icon: HomeIcon },
    { name: 'Students', href: '/dashboard/admin/students', icon: UserGroupIcon },
    { name: 'Teachers', href: '/dashboard/admin/teachers', icon: AcademicCapIcon },
    { name: 'Classes', href: '/dashboard/admin/classes', icon: BookOpenIcon },
    { name: 'Exams', href: '/dashboard/admin/exams', icon: DocumentTextIcon },
    { name: 'Finance', href: '/dashboard/admin/finance', icon: CreditCardIcon },
    { name: 'Attendance', href: '/dashboard/admin/attendance', icon: CalendarIcon },
    { name: 'Library', href: '/dashboard/admin/library', icon: BookOpenIcon },
    { name: 'LMS', href: '/dashboard/admin/lms', icon: ComputerDesktopIcon },
    { name: 'Settings', href: '/dashboard/admin/settings', icon: CogIcon },
  ],
  teacher: [
    { name: 'Dashboard', href: '/dashboard/teacher', icon: HomeIcon },
    { name: 'My Classes', href: '/dashboard/teacher/classes', icon: BookOpenIcon },
    { name: 'Students', href: '/dashboard/teacher/students', icon: UserGroupIcon },
    { name: 'Assignments', href: '/dashboard/teacher/assignments', icon: DocumentTextIcon },
    { name: 'Exams', href: '/dashboard/teacher/exams', icon: CalculatorIcon },
    { name: 'Attendance', href: '/dashboard/teacher/attendance', icon: CalendarIcon },
    { name: 'LMS', href: '/dashboard/teacher/lms', icon: ComputerDesktopIcon },
  ],
  student: [
    { name: 'Dashboard', href: '/dashboard/student', icon: HomeIcon },
    { name: 'My Classes', href: '/dashboard/student/classes', icon: BookOpenIcon },
    { name: 'Assignments', href: '/dashboard/student/assignments', icon: DocumentTextIcon },
    { name: 'Exams', href: '/dashboard/student/exams', icon: CalculatorIcon },
    { name: 'Attendance', href: '/dashboard/student/attendance', icon: CalendarIcon },
    { name: 'LMS', href: '/dashboard/student/lms', icon: ComputerDesktopIcon },
    { name: 'Grades', href: '/dashboard/student/grades', icon: ChartBarIcon },
    { name: 'Finance', href: '/dashboard/student/finance', icon: CreditCardIcon },
  ],
  parent: [
    { name: 'Dashboard', href: '/dashboard/parent', icon: HomeIcon },
    { name: 'Children', href: '/dashboard/parent/children', icon: UserGroupIcon },
    { name: 'Progress', href: '/dashboard/parent/progress', icon: ChartBarIcon },
    { name: 'Finance', href: '/dashboard/parent/finance', icon: CreditCardIcon },
    { name: 'Attendance', href: '/dashboard/parent/attendance', icon: CalendarIcon },
  ],
};

// ---------------------------------------------------------------------------
// Main Layout Component
// ---------------------------------------------------------------------------
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [currentSchool, setCurrentSchool] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Fetch user and profile
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, full_name, school_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profileData) {
          console.error('Profile not found', profileError);
          await supabase.auth.signOut();
          router.push('/login?error=profile_not_found');
          return;
        }

        const currentProfile = profileData as any;
        setProfile(currentProfile);

        // If school_id is set, fetch all schools (for super_admin) or just the user's school
        if (currentProfile.role === 'super_admin') {
          // Fetch all schools
          const { data: schoolsData } = await supabase
            .from('schools')
            .select('id, name, slug')
            .order('name');
          if (schoolsData) setSchools(schoolsData as any[]);
          if (schoolsData && schoolsData.length > 0) {
            const firstSchool = schoolsData[0] as any;
            setCurrentSchool({ id: firstSchool.id, name: firstSchool.name });
          }
        } else if (currentProfile.school_id) {
          // Fetch the single school
          const { data: schoolData } = await supabase
            .from('schools')
            .select('id, name')
            .eq('id', currentProfile.school_id)
            .single();
          if (schoolData) {
            const singleSchool = schoolData as any;
            setSchools([singleSchool]);
            setCurrentSchool({ id: singleSchool.id, name: singleSchool.name });
          }
        }

        // Fetch notifications (mock for now)
        setNotifications([
          { id: '1', message: 'New assignment due tomorrow', type: 'info', read: false },
          { id: '2', message: 'Fee payment pending', type: 'warning', read: false },
        ]);

      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [supabase, router]);

  // -------------------------------------------------------------------------
  // Navigation items based on role
  // -------------------------------------------------------------------------
  const navItems = useMemo(() => {
    if (!profile || !profile.role) return [];
    return NAV_ITEMS[profile.role as UserRole] || [];
  }, [profile]);

  // -------------------------------------------------------------------------
  // Close mobile sidebar on route change
  // -------------------------------------------------------------------------
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // -------------------------------------------------------------------------
  // Keyboard shortcut: Ctrl+K to focus search
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // -------------------------------------------------------------------------
  // Handle sign out
  // -------------------------------------------------------------------------
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // -------------------------------------------------------------------------
  // If loading, show a minimal skeleton
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-700 h-12 w-12"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 280 : 0,
          transition: { duration: 0.3, ease: 'easeInOut' },
        }}
        className={`fixed top-0 left-0 h-full bg-gray-900 border-r border-gray-800 z-50 overflow-hidden flex flex-col ${
          mobileSidebarOpen ? 'block lg:hidden' : 'hidden lg:flex'
        }`}
        style={{ width: sidebarOpen ? 280 : 0 }}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              Z
            </div>
            <span className="text-lg font-bold text-white truncate">
              ZEIS Command
            </span>
          </div>
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(false);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white lg:hidden"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="hidden lg:flex p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        </div>

        {/* School switcher (only if multiple schools) */}
        {schools.length > 1 && profile?.role === 'super_admin' && (
          <div className="px-4 py-2 border-b border-gray-800">
            <select
              value={currentSchool?.id || ''}
              onChange={(e) => {
                const school = schools.find((s) => s.id === e.target.value);
                if (school) setCurrentSchool({ id: school.id, name: school.name });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors
                  ${isActive
                    ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer - user profile mini */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {profile?.role?.replace('_', ' ').toUpperCase() || 'Student'}
              </p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main content wrapper */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out`}>
        {/* Header */}
        <header className="h-16 bg-gray-900/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileSidebarOpen(true);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="p-2 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
            >
              {sidebarOpen ? (
                <ChevronLeftIcon className="h-5 w-5" />
              ) : (
                <Bars3Icon className="h-5 w-5" />
              )}
            </button>
            <div className="hidden md:flex relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-md pl-9 pr-4 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 lg:w-96"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <BellIcon className="h-5 w-5" />
                {notifications.some((n) => !n.read) && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 mt-2 w-72 bg-gray-800 rounded-md shadow-lg border border-gray-700 overflow-hidden z-50"
                  >
                    <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                      <button className="text-xs text-blue-400 hover:underline">Mark all read</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-700">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div key={n.id} className="p-3 hover:bg-gray-700 flex items-start space-x-3">
                            <div className="flex-1">
                              <p className="text-sm text-gray-200">{n.message}</p>
                              <span className="text-xs text-gray-500">Just now</span>
                            </div>
                            {!n.read && <div className="h-2 w-2 rounded-full bg-blue-400 mt-1"></div>}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-800"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
              </button>
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-md shadow-lg border border-gray-700 overflow-hidden z-50"
                  >
                    <div className="p-3 border-b border-gray-700">
                      <p className="text-sm font-semibold text-white">{profile?.full_name}</p>
                      <p className="text-xs text-gray-400">{profile?.role?.replace('_', ' ').toUpperCase()}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/dashboard/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                        Profile
                      </Link>
                      <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                        Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                      >
                        <ArrowRightStartOnRectangleIcon className="h-4 w-4 inline-block mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}