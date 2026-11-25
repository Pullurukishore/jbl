'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { saveAuthData } from '@/lib/auth';
import { LoginResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, refreshAuth } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only auto-redirect if already authenticated and not in middle of login success transition
    if (!isLoading && isAuthenticated && !successMsg) {
      router.replace('/app/dashboard');
    }
  }, [isAuthenticated, isLoading, router, successMsg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      setError('User ID and Password are required.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiPost<LoginResponse>('/auth/authenticate', {
        user_id: userId,
        password,
      });

      if (res.success && res.data?.id_token) {
        saveAuthData(res);
        setSuccessMsg('Login successful! Redirecting to dashboard...');
        setTimeout(() => {
          refreshAuth();
          router.push('/app/dashboard');
        }, 1200);
      } else {
        setError('Login failed. Please check credentials.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid User ID or Password');
      setLoading(false);
    }
  };

  return (
    <form className="form w-100" onSubmit={handleSubmit} noValidate autoComplete="off">
      <style jsx>{`
        .page-bg {
          background-image: url('/assets/images/login-bg.png');
          background-size: cover;
          background-position: center;
          position: relative;
        }
        .mask {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .card {
          border-radius: 12px;
          box-shadow: 0 4px 6px #0000001a;
          padding: 0 30px;
          background: #ffffff;
        }
        @media (max-width: 576px) {
          .card {
            padding: 0 12px;
          }
          .card .login-container {
            padding: 24px 6px;
          }
        }
        .card .login-container {
          padding: 30px 10px;
          text-align: center;
        }
        .card .logo {
          height: 48px;
          margin-bottom: 12px;
        }
        .card .form-control {
          border-radius: 6px;
          padding: 12px;
        }
        .toggle-password-btn {
          top: 8px;
          right: 10px;
          background: transparent;
          border: none;
          color: #6c757d;
          cursor: pointer;
        }
      `}</style>

      <main className="main-content mt-0">
        <div className="page-header align-items-start min-vh-100 page-bg d-flex">
          <span className="mask bg-gradient-dark opacity-6"></span>
          <div className="container my-auto z-index-1">
            <div className="row min-vh-100 d-flex align-items-center justify-content-center">
              <div className="col-lg-5 col-md-7 col-12 my-auto mx-auto">
                <div className="card z-index-0 fadeIn3 fadeInBottom">
                  <div className="login-container">
                    <img src="/assets/logo/logo.svg" alt="Logo" className="logo" />
                    <h4 className="fw-bold mt-3 mb-1 text-center">Jabil Adapter Validation</h4>
                    <p className="text-muted small mb-3">Sign in to your account</p>

                    {successMsg && (
                      <div className="alert alert-success d-flex align-items-center justify-content-center gap-2 py-2" role="alert">
                        <CheckCircle2 size={18} />
                        <span className="fw-semibold">{successMsg}</span>
                      </div>
                    )}

                    {error && (
                      <div className="alert alert-danger" role="alert">
                        {error}
                      </div>
                    )}

                    <div className="mb-3 text-start">
                      <label htmlFor="user_id" className="form-label fw-semibold">
                        User Id
                      </label>
                      <input
                        type="text"
                        id="user_id"
                        className="form-control"
                        placeholder="Enter your User Id"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        required
                        autoFocus
                        disabled={loading || !!successMsg}
                      />
                    </div>

                    <div className="mb-3 text-start">
                      <label htmlFor="password" className="form-label fw-semibold">
                        Password
                      </label>
                      <div className="position-relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          className="form-control"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading || !!successMsg}
                        />
                        <button
                          type="button"
                          className="toggle-password-btn position-absolute"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loading || !!successMsg}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`btn ${successMsg ? 'btn-success' : 'btn-primary'} login-btn w-100 mt-3 d-flex align-items-center justify-content-center gap-2`}
                      disabled={loading || !!successMsg}
                    >
                      {successMsg ? (
                        <>
                          <CheckCircle2 size={18} /> Redirecting...
                        </>
                      ) : loading ? (
                        'Authenticating...'
                      ) : (
                        'Login'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </form>
  );
}
