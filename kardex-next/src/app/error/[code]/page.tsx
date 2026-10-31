'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertOctagon, FileQuestion, ServerCrash, Wrench, Home } from 'lucide-react';

const ERROR_CONFIG: Record<
  string,
  { title: string; subtitle: string; icon: React.ReactNode }
> = {
  '403': {
    title: 'Not Authorized',
    subtitle: 'You are not authorized to perform this operation!',
    icon: <AlertOctagon size={64} color="#ef4444" />,
  },
  '404': {
    title: 'Page Not Found',
    subtitle: 'The page you are looking for does not exist or has been moved.',
    icon: <FileQuestion size={64} color="#64748b" />,
  },
  '500': {
    title: 'System Error',
    subtitle: 'Something went wrong on our servers. Please try again later.',
    icon: <ServerCrash size={64} color="#f59e0b" />,
  },
  '503': {
    title: 'Service Unavailable',
    subtitle: 'The service is temporarily unavailable. Please check back soon.',
    icon: <Wrench size={64} color="#06b6d4" />,
  },
};

export default function ErrorPage() {
  const params = useParams();
  const code = (params?.code as string) || '404';

  const error = ERROR_CONFIG[code] || ERROR_CONFIG['404'];

  return (
    <div className="error-shell">
      <style jsx>{`
        .error-shell {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: #f8fafc;
          padding: 2rem;
          text-align: center;
        }

        .logo-box {
          margin-bottom: 2rem;
        }

        .logo-box img {
          height: 60px;
          width: auto;
        }

        .error-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 3rem 2.5rem;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .icon-container {
          margin-bottom: 1.25rem;
        }

        .error-code {
          font-size: 2.5rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }

        .error-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #334155;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .error-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        .btn-home {
          background-color: #0d6efd;
          color: #ffffff;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: background-color 0.2s ease;
        }

        .btn-home:hover {
          background-color: #0b5ed7;
        }
      `}</style>

      <div className="logo-box">
        <img src="/assets/logo/logo.svg" alt="Kardex Logo" />
      </div>

      <div className="error-card">
        <div className="icon-container">{error.icon}</div>
        <span className="error-code">{code}</span>
        <h2 className="error-title">{error.title}</h2>
        <p className="error-subtitle">{error.subtitle}</p>

        <Link href="/app/dashboard" className="btn-home">
          <Home size={18} />
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
