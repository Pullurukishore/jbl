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
  Layers,
  Menu,
  X,
  Boxes,
  FileBarChart,
} from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, canPut, canPick, isLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

        @media (max-width: 768px) {
          .app-header-navbar {
            padding: 8px 12px;
          }
        }

        .header-inner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 0.75rem;
        }

        /* Mobile Header Left */
        .mobile-header-brand {
          display: none;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .mobile-header-brand {
            display: flex;
          }
        }

        .btn-hamburger {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #334155;
          width: 36px;
          height: 36px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-hamburger:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .brand-title-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: #0f172a;
          font-weight: 800;
          font-size: 14.5px;
          letter-spacing: -0.3px;
        }

        .brand-logo-pill {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          padding: 3px 6px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        /* Navigation Dock (Desktop & Tablet) */
        .nav-dock-wrapper {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 3px;
          gap: 3px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .nav-dock-wrapper::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 768px) {
          .nav-dock-wrapper {
            display: none;
          }
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
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }

        @media (max-width: 992px) {
          :global(a.dock-nav-link) {
            padding: 5px 10px !important;
            font-size: 12px !important;
            gap: 5px !important;
          }
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
          padding: 4px 6px;
          gap: 10px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.03);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        @media (max-width: 576px) {
          .operator-card-pill {
            gap: 6px;
            padding: 3px 5px;
          }
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
          flex-shrink: 0;
        }

        .btn-power-logout:hover {
          background: #ef4444;
          color: #ffffff;
          border-color: #ef4444;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(239, 68, 68, 0.3);
        }

        /* Mobile Drawer / Slide Down Menu */
        .mobile-nav-drawer {
          position: fixed;
          top: 53px;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.18s ease;
        }

        .mobile-nav-panel {
          background: #ffffff;
          border-bottom: 2px solid #e2e8f0;
          padding: 1rem 1rem 1.25rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        :global(a.mobile-nav-item) {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 11px 16px !important;
          border-radius: 10px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #475569 !important;
          text-decoration: none !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          transition: all 0.15s ease !important;
        }

        :global(a.mobile-nav-item:hover) {
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }

        :global(a.mobile-nav-item.active) {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          color: #ffffff !important;
          border-color: #2563eb !important;
          font-weight: 700 !important;
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.28) !important;
        }

        .mobile-user-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #f1f5f9;
          border-radius: 10px;
          margin-bottom: 6px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .main-content-layout {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-height: calc(100vh - 65px);
          display: flex;
          flex-direction: column;
          padding: 1rem 1.25rem;
        }

        @media (max-width: 768px) {
          .main-content-layout {
            padding: 0.65rem 0.6rem;
            min-height: calc(100vh - 55px);
          }
        }
      `}</style>

      {/* Modern Clean Header Navigation Bar */}
      <header className="app-header-navbar">
        <div className="header-inner-row">
          {/* Mobile Left: Menu Toggle + Brand */}
          <div className="mobile-header-brand">
            <button
              className="btn-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              title="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link href="/app/dashboard" className="brand-title-badge">
              <span className="brand-logo-pill">KARDEX</span>
              <span>Inventory</span>
            </Link>
          </div>

          {/* Desktop & Tablet: Segmented Navigation Dock */}
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
              href="/app/materials"
              className={`dock-nav-link ${pathname.startsWith('/app/materials') ? 'active' : ''}`}
            >
              <Layers size={14} /> Materials
            </Link>

            <Link
              href="/app/reports"
              className={`dock-nav-link ${pathname.startsWith('/app/reports') ? 'active' : ''}`}
            >
              <FileBarChart size={14} /> Reports
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

      {/* Mobile Slide-down Navigation Panel */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-user-row">
              <div className="d-flex align-items-center gap-2">
                <div className="operator-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                  {userInitial}
                </div>
                <div className="operator-details">
                  <span className="operator-name" style={{ maxWidth: '180px' }}>{fullName}</span>
                  <span className="operator-role">{roleTitle}</span>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '12px', borderRadius: '7px' }}
                onClick={logout}
              >
                <Power size={12} /> Logout
              </button>
            </div>

            <Link
              href="/app/dashboard"
              className={`mobile-nav-item ${pathname === '/app/dashboard' ? 'active' : ''}`}
            >
              <PieChart size={16} /> Dashboard
            </Link>

            {canPut && (
              <Link
                href="/app/hu-put"
                className={`mobile-nav-item ${pathname.startsWith('/app/hu-put') ? 'active' : ''}`}
              >
                <PackagePlus size={16} /> Handling Unit PUT
              </Link>
            )}

            {canPick && (
              <Link
                href="/app/pick"
                className={`mobile-nav-item ${pathname.startsWith('/app/pick') ? 'active' : ''}`}
              >
                <PackageMinus size={16} /> Pick Workstation
              </Link>
            )}

            <Link
              href="/app/materials"
              className={`mobile-nav-item ${pathname.startsWith('/app/materials') ? 'active' : ''}`}
            >
              <Layers size={16} /> Materials Inventory
            </Link>

            <Link
              href="/app/reports"
              className={`mobile-nav-item ${pathname.startsWith('/app/reports') ? 'active' : ''}`}
            >
              <FileBarChart size={16} /> Aging Reports
            </Link>

            {isAdmin && (
              <Link
                href="/app/users"
                className={`mobile-nav-item ${pathname === '/app/users' ? 'active' : ''}`}
              >
                <Users size={16} /> User Management
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main Page Area */}
      <main className="main-content-layout">
        {children}
      </main>
    </div>
  );
}
