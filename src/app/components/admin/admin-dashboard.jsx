import { useState, useEffect } from 'react';
import {
  Users,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Trash2,
  Filter,
  Search,
} from 'lucide-react';
import {
  readPreferences,
  writePreferences,
  subscribePreferences,
} from '../../lib/user-preferences';

import {
  getDashboardStats,
  getProducts,
  getUsers,
  deleteUser
} from '../../../api/admin';
import { ConfirmDialog } from '../ui/confirm-dialog';

export function AdminDashboard({ onLogout }) {

  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState('name_asc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => Boolean(readPreferences().darkMode));
  const [pendingUserDelete, setPendingUserDelete] = useState(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    activeQueries: 0,
    totalRevenue: 0
  });

  const [systemStatus, setSystemStatus] = useState({
    api: false,
    database: false,
    server: true
  });

  const loadDashboardData = async () => {
    try {
      const [statsResponse, productsResponse, usersResponse] = await Promise.all([
        getDashboardStats(),
        getProducts(),
        getUsers()
      ]);

      setStats(statsResponse?.data || {});
      setProducts(productsResponse?.data || []);

      const filteredUsers = (usersResponse?.data || []).filter(
        (user) => String(user?.role || '').toLowerCase() !== "admin"
      );

      setUsers(filteredUsers);

      setSystemStatus({
        api: true,
        database: true,
        server: true
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);

      setSystemStatus({
        api: false,
        database: false,
        server: true
      });

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => subscribePreferences((prefs) => setIsDarkMode(Boolean(prefs.darkMode))), []);

  useEffect(() => {
    if (!isSortOpen) return;
    const onClickOutside = (event) => {
      const sortRoot = document.getElementById('admin-user-sort-root');
      if (sortRoot && !sortRoot.contains(event.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isSortOpen]);

  const handleDeleteUser = async (id) => {
    try {
      await deleteUser(id);
      loadDashboardData();
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const requestDeleteUser = (user) => {
    if (!user?._id) return;
    setPendingUserDelete({
      id: user._id,
      name: user.name || 'this user',
    });
  };

  const toggleTheme = () => {
    const nextDarkMode = !isDarkMode;
    const root = document.documentElement;
    if (nextDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    const current = readPreferences();
    writePreferences({ ...current, darkMode: nextDarkMode });
    setIsDarkMode(nextDarkMode);
  };

  const nonAdminTotalUsers = Math.max(0, (Number(stats.totalUsers) || 0) - 1);
  const userSortLabelMap = {
    name_asc: 'Name: A to Z',
    name_desc: 'Name: Z to A',
    joined_newest: 'Joined: Newest',
    joined_oldest: 'Joined: Oldest',
  };
  const userSortOptions = Object.entries(userSortLabelMap).map(([value, label]) => ({
    value,
    label,
  }));
  const visibleUsers = [...users]
    .filter((user) => {
      const name = String(user?.name || '').toLowerCase();
      const email = String(user?.email || '').toLowerCase();
      const query = userSearch.trim().toLowerCase();
      return !query || name.includes(query) || email.includes(query);
    })
    .sort((a, b) => {
      if (userSort === 'name_asc') {
        return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, {
          sensitivity: 'base',
        });
      }
      if (userSort === 'name_desc') {
        return String(b?.name || '').localeCompare(String(a?.name || ''), undefined, {
          sensitivity: 'base',
        });
      }

      const dateA = new Date(a?.createdAt || a?.created_at || 0).getTime();
      const dateB = new Date(b?.createdAt || b?.created_at || 0).getTime();
      if (userSort === 'joined_newest') return dateB - dateA;
      if (userSort === 'joined_oldest') return dateA - dateB;
      return 0;
    });

  return (
    <div className="admin-shell min-h-screen bg-background">

      {/* HEADER */}
      <header className="admin-header glass-strong border-b border-slate-700/50 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Admin Dashboard</h1>
              <p className="text-xs text-slate-400">SmartPick Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="admin-theme-toggle p-2.5 rounded-lg glass hover:bg-slate-700/50"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-teal-700" />
              )}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg glass hover:bg-slate-700/50 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 hidden md:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* NAV */}
      <div className="admin-tabs border-b border-slate-800 sticky top-[72px] mt-1 z-40 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <nav className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* MAIN */}
      <main className="admin-main max-w-7xl mx-auto px-4 pt-20 md:pt-24 pb-8 md:pb-16">

        {loading ? (
          <div className="text-center py-20 text-slate-400">
            Loading dashboard data...
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">

                {/* Stats Cards */}
                <div className="w-full">
                  <div className="glass-strong rounded-2xl p-6 relative h-full">
                    <div className="absolute top-4 right-4 flex items-center gap-1 text-xs text-emerald-400">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                      Live
                    </div>

                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div className="text-3xl font-semibold text-slate-100 mb-1">
                      {nonAdminTotalUsers.toLocaleString()}
                    </div>

                    <div className="text-sm text-slate-400">
                      Total Users
                    </div>
                  </div>
                </div>

                {/* Recent Users + System Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Recent Users */}
                  <div className="glass-strong rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">
                      Recent Users
                    </h3>

                    {users.slice(0, 5).length === 0 ? (
                      <p className="text-slate-400 text-sm">No users found</p>
                    ) : (
                      <div className="space-y-3">
                        {users.slice(0, 5).map((user) => (
                          <div
                            key={user._id}
                            className="flex justify-between items-center border-b border-slate-700 pb-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {user.name}
                              </p>
                              <p className="text-slate-400 text-xs">
                                {user.email}
                              </p>
                            </div>
                            <span className="text-xs text-teal-400 capitalize">
                              {user.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* System Status */}
                  <div className="glass-strong rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">
                      System Status
                    </h3>

                    <div className="space-y-4 text-sm">

                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">API Status</span>
                        <span className={`flex items-center gap-2 ${systemStatus.api ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${systemStatus.api ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          {systemStatus.api ? 'Operational' : 'Down'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Database</span>
                        <span className={`flex items-center gap-2 ${systemStatus.database ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${systemStatus.database ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          {systemStatus.database ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Server</span>
                        <span className={`flex items-center gap-2 ${systemStatus.server ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${systemStatus.server ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          {systemStatus.server ? 'Running' : 'Stopped'}
                        </span>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="admin-users-panel glass-strong rounded-2xl overflow-hidden">
                <div className="admin-users-toolbar p-3 md:p-4 border-b flex flex-row items-center gap-2 md:gap-3">
                  <div className="relative flex-1 md:max-w-sm">
                    <Search className="admin-filter-icon absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users..."
                      className="admin-users-input w-full rounded-xl border pl-9 pr-3 py-2 md:py-2.5 outline-none text-sm md:text-base"
                    />
                  </div>
                  <div id="admin-user-sort-root" className="relative w-auto shrink-0 self-end md:self-start md:mr-auto">
                    <button
                      type="button"
                      onClick={() => setIsSortOpen((open) => !open)}
                      className="admin-users-sort admin-users-filter-icon-btn p-2 md:p-3 flex items-center justify-center"
                      aria-label={`Sort users (${userSortLabelMap[userSort] || 'Sort users'})`}
                      title={userSortLabelMap[userSort] || 'Sort users'}
                    >
                      <Filter className="admin-filter-icon w-4 h-4 shrink-0" />
                    </button>
                    {isSortOpen && (
                      <div className="admin-users-sort-menu absolute right-0 mt-2 w-full md:w-[220px] z-30 rounded-lg border shadow-xl overflow-hidden">
                        {userSortOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setUserSort(option.value);
                              setIsSortOpen(false);
                            }}
                            data-active={userSort === option.value ? 'true' : 'false'}
                            className="admin-users-sort-option w-full text-left px-3 py-2 text-sm transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="overflow-x-hidden">
                  <table className="admin-users-table w-full table-fixed">
                    <colgroup>
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead className="admin-users-thead border-b">
                      <tr>
                        <th className="text-left px-3 md:px-6 py-3 md:py-4 text-xs md:text-base">Name</th>
                        <th className="text-left px-3 md:px-6 py-3 md:py-4 text-xs md:text-base">Email</th>
                        <th className="text-left px-3 md:px-6 py-3 md:py-4 text-xs md:text-base">Role</th>
                        <th className="text-left pl-3 pr-6 md:pl-6 md:pr-8 py-3 md:py-4 text-xs md:text-base whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map(user => (
                        <tr key={user._id} className="admin-users-row border-b">
                          <td className="px-3 md:px-6 py-3 md:py-4 text-sm md:text-base truncate">{user.name}</td>
                          <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-base break-all leading-tight">{user.email}</td>
                          <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-base">{user.role}</td>
                          <td className="text-left pl-3 pr-6 md:pl-6 md:pr-8 py-3 md:py-4">
                            <button
                              onClick={() => requestDeleteUser(user)}
                              className="admin-delete-btn inline-flex items-center justify-center p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                              aria-label={`Delete ${user.name}`}
                              title={`Delete ${user.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {visibleUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                            No users match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </>
        )}
      </main>
      <ConfirmDialog
        open={Boolean(pendingUserDelete)}
        title="Delete user?"
        description={
          pendingUserDelete
            ? `This will permanently remove "${pendingUserDelete.name}".`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setPendingUserDelete(null)}
        onConfirm={async () => {
          if (pendingUserDelete?.id) {
            await handleDeleteUser(pendingUserDelete.id);
          }
          setPendingUserDelete(null);
        }}
      />
    </div>
  );
}
