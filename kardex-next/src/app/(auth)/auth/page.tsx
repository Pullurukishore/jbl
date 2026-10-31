'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { saveAuthData } from '@/lib/auth';
import { LoginResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, refreshAuth } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/app/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

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
        refreshAuth();
        router.push('/app/dashboard');
      } else {
        setError('Login failed. Please check credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid User ID or Password');
    } finally {
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
                    <h3 className="fw-bold mb-3 mt-3 text-center">Sign In</h3>

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
                        />
                        <button
                          type="button"
                          className="toggle-password-btn position-absolute"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary login-btn w-100 mt-3"
                      disabled={loading}
                    >
                      {loading ? 'Authenticating...' : 'Login'}
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
