'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  PieChart,
  Users,
  Power,
  PackagePlus,
  PackageMinus,
  Boxes,
  Layers,
} from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, canPut, canPick, isLoading, logout } = useAuth();
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
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.03);
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
          border-radius: 11px;
          padding: 3px;
          gap: 3px;
        }

        :global(a.dock-nav-link) {
          font-size: 12.5px !important;
          font-weight: 600 !important;
          color: #64748b !important;
          text-decoration: none !important;
          padding: 6px 14px !important;
          border-radius: 8px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border: 1px solid transparent !important;
          user-select: none !important;
        }

        :global(a.dock-nav-link:hover) {
          color: #0f172a !important;
          background: rgba(255, 255, 255, 0.8) !important;
          text-decoration: none !important;
        }

        :global(a.dock-nav-link.active) {
          color: #ffffff !important;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
          border-color: transparent !important;
          font-weight: 700 !important;
          text-decoration: none !important;
        }

        /* Operator Profile Badge */
        .operator-card-pill {
          display: inline-flex;
          align-items: center;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 4px 6px 4px 6px;
          gap: 10px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.03);
          transition: all 0.2s ease;
        }

        .operator-card-pill:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.07);
        }

        .operator-avatar {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 12.5px;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28);
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
          font-size: 9.5px;
          font-weight: 800;
          color: #2563eb;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .btn-power-logout {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #ef4444;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          margin-left: 2px;
        }

        .btn-power-logout:hover {
          background: #ef4444;
          color: #ffffff;
          border-color: #ef4444;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(239, 68, 68, 0.3);
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
              <PieChart size={14} /> Dashboard
            </Link>

            {canPut && (
              <Link
                href="/app/hu-put"
                className={`dock-nav-link ${pathname.startsWith('/app/hu-put') ? 'active' : ''}`}
              >
                <PackagePlus size={14} /> HU Put
              </Link>
            )}

            {canPick && (
              <Link
                href="/app/pick"
                className={`dock-nav-link ${pathname.startsWith('/app/pick') ? 'active' : ''}`}
              >
                <PackageMinus size={14} /> Pick
              </Link>
            )}

            <Link
              href="/app/bins"
              className={`dock-nav-link ${pathname === '/app/bins' ? 'active' : ''}`}
            >
              <Boxes size={14} /> Bins
            </Link>

            <Link
              href="/app/materials"
              className={`dock-nav-link ${pathname.startsWith('/app/materials') ? 'active' : ''}`}
            >
              <Layers size={14} /> Materials
            </Link>

            {isAdmin && (
              <Link
                href="/app/users"
                className={`dock-nav-link ${pathname === '/app/users' ? 'active' : ''}`}
              >
                <Users size={14} /> User List
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
