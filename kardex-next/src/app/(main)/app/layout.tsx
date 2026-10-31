'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PieChart, Users, Power, UserCheck } from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-vh-100 bg-light-app">
      <style jsx>{`
        .bg-light-app {
          background-color: #f8fafc;
        }

        .header-bar {
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        :global(a.nav-pill-item) {
          font-size: 13.5px !important;
          font-weight: 500 !important;
          color: #64748b !important;
          text-decoration: none !important;
          padding: 7px 18px !important;
          border-radius: 9999px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border: 1px solid transparent !important;
        }

        :global(a.nav-pill-item:hover) {
          color: #0f172a !important;
          background-color: rgba(241, 245, 249, 0.8) !important;
          text-decoration: none !important;
        }

        :global(a.nav-pill-item.active) {
          color: #2563eb !important;
          background-color: #ffffff !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          border: 1px solid #e2e8f0 !important;
          text-decoration: none !important;
        }

        .user-profile-card {
          display: inline-flex;
          align-items: center;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          padding: 4px 14px 4px 5px;
          gap: 10px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .user-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.25;
        }

        .user-name-text {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }

        .user-role-badge {
          font-size: 10px;
          font-weight: 600;
          color: #2563eb;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .btn-logout-icon {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #ef4444;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-left: 2px;
        }

        .btn-logout-icon:hover {
          background: #ef4444;
          color: #ffffff;
          border-color: #ef4444;
          transform: scale(1.05);
        }
      `}</style>

      {/* Modern Header Navigation Bar */}
      <header className="header-bar">
        <div className="container-fluid d-flex align-items-center justify-content-between">
          {/* Left: Brand / Navigation Pills */}
          <div className="d-flex align-items-center gap-3">
            <div className="nav-pill-container">
              <Link
                href="/app/dashboard"
                className={`nav-pill-item ${pathname === '/app/dashboard' ? 'active' : ''
                  }`}
              >
                <PieChart size={15} /> Dashboard
              </Link>

              {isAdmin && (
                <Link
                  href="/app/users"
                  className={`nav-pill-item ${pathname === '/app/users' ? 'active' : ''
                    }`}
                >
                  <Users size={15} /> User List
                </Link>
              )}
            </div>
          </div>

          {/* Right: User Profile & Logout */}
          <div className="user-profile-card">
            <div className="avatar-circle">
              {user?.first_name?.[0]?.toUpperCase() || 'U'}
            </div>

            <div className="user-meta">
              <span className="user-name-text">
                {user?.first_name} {user?.last_name || ''}
              </span>
              <span className="user-role-badge">{user?.role}</span>
            </div>

            <button
              className="btn-logout-icon"
              onClick={logout}
              title="Logout"
            >
              <Power size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <div className="container-fluid px-4 py-4">{children}</div>
    </div>
  );
}
