'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  PieChart,
  Users,
  Power,
  Package,
  PackageSearch,
} from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const userInitial = user?.first_name?.[0]?.toUpperCase() || user?.user_id?.[0]?.toUpperCase() || 'U';
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.user_id || 'Operator';
  const roleTitle = user?.role || (isAdmin ? 'ADMIN' : 'OPERATOR');

  return (
    <div className="min-vh-100 bg-light-app">
      <style jsx>{`
        .bg-light-app {
          background-color: #f8fafc;
          min-height: 100vh;
        }

        /* Top Header Navbar Bar */
        .app-header-navbar {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1.5px solid #e2e8f0;
          padding: 8px 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .header-inner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 1rem;
        }

        /* Navigation Dock */
        .nav-dock-wrapper {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          padding: 4px;
          gap: 3px;
        }

        :global(a.dock-nav-link) {
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #64748b !important;
          text-decoration: none !important;
          padding: 6px 16px !important;
          border-radius: 9999px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border: 1px solid transparent !important;
          user-select: none !important;
        }

        :global(a.dock-nav-link:hover) {
          color: #0f172a !important;
          background: rgba(255, 255, 255, 0.7) !important;
          text-decoration: none !important;
        }

        :global(a.dock-nav-link.active) {
          color: #1d4ed8 !important;
          background: #ffffff !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          border-color: #e2e8f0 !important;
          font-weight: 700 !important;
          text-decoration: none !important;
        }

        /* Operator Profile Badge */
        .operator-card-pill {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 9999px;
          padding: 4px 6px 4px 5px;
          gap: 10px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
        }

        .operator-card-pill:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .operator-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
          flex-shrink: 0;
        }

        .operator-details {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
          text-align: left;
        }

        .operator-name {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .operator-role {
          font-size: 10px;
          font-weight: 800;
          color: #2563eb;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .btn-power-logout {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #ef4444;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          margin-left: 2px;
        }

        .btn-power-logout:hover {
          background: #ef4444;
          color: #ffffff;
          border-color: #ef4444;
          transform: scale(1.08);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);
        }
      `}</style>

      {/* Modern Clean Header Navigation Bar */}
      <header className="app-header-navbar">
        <div className="header-inner-row">
          {/* Left: Segmented Navigation Dock */}
          <nav className="nav-dock-wrapper" aria-label="Main Navigation">
            <Link
              href="/app/dashboard"
              className={`dock-nav-link ${pathname === '/app/dashboard' ? 'active' : ''}`}
            >
              <PieChart size={15} /> Dashboard
            </Link>

            <Link
              href="/app/bins"
              className={`dock-nav-link ${pathname.startsWith('/app/bins') ? 'active' : ''}`}
            >
              <Package size={15} /> Bins
            </Link>

            <Link
              href="/app/hu-pick"
              className={`dock-nav-link ${pathname === '/app/hu-pick' ? 'active' : ''}`}
            >
              <PackageSearch size={15} /> HU Pick
            </Link>

            {isAdmin && (
              <Link
                href="/app/users"
                className={`dock-nav-link ${pathname === '/app/users' ? 'active' : ''}`}
              >
                <Users size={15} /> User List
              </Link>
            )}
          </nav>

          {/* Right: User Profile Capsule & Logout */}
          <div className="operator-card-pill">
            <div className="operator-avatar" title={fullName}>
              {userInitial}
            </div>

            <div className="operator-details d-none d-sm-flex">
              <span className="operator-name">{fullName}</span>
              <span className="operator-role">{roleTitle}</span>
            </div>

            <button
              className="btn-power-logout"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <Power size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="container-fluid px-4 py-4">{children}</main>
    </div>
  );
}
