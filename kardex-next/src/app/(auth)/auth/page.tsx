'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { saveAuthData } from '@/lib/auth';
import { LoginResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Shield,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Boxes,
  Layers,
  Loader2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshAuth } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount effect to prevent SSR hydration flicker on reload
  useEffect(() => {
    setMounted(true);
    try {
      const savedUser = localStorage.getItem('kardex_remembered_user');
      if (savedUser) {
        setUserId(savedUser);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  // Safe redirect if already logged in (avoids infinite bounce on reload)
  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated && !loginSuccess) {
      const timer = setTimeout(() => {
        router.replace('/app/dashboard');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [mounted, isAuthenticated, isLoading, router, loginSuccess]);

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 550);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password) {
      triggerError('User ID and Password are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await apiPost<LoginResponse>('/auth/authenticate', {
        user_id: userId.trim(),
        password,
      });

      if (res.success && res.data?.id_token) {
        saveAuthData(res);

        if (rememberMe) {
          localStorage.setItem('kardex_remembered_user', userId.trim());
        } else {
          localStorage.removeItem('kardex_remembered_user');
        }

        setLoginSuccess(true);
        refreshAuth();

        setTimeout(() => {
          router.replace('/app/dashboard');
        }, 900);
      } else {
        triggerError('Login failed. Please verify your credentials.');
        setSubmitting(false);
      }
    } catch (err: any) {
      triggerError(err.message || 'Invalid User ID or Password.');
      setSubmitting(false);
    }
  };

  // Prevent hydration mismatch
  if (!mounted) return null;

  // Interstitial screen when already logged in and page is reloaded
  if (isAuthenticated && user && !isLoading && !loginSuccess) {
    return (
      <div className="login-wrapper auth-loading-screen">
        <style jsx global>{`
          html, body {
            overflow: hidden !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `}</style>
        <style jsx>{`
          .login-wrapper {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: 
              linear-gradient(135deg, rgba(6, 10, 18, 0.90) 0%, rgba(10, 18, 36, 0.85) 50%, rgba(6, 10, 18, 0.92) 100%),
              url('/assets/images/kardex-warehouse-ai.jpg') center/cover no-repeat;
            color: #ffffff;
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 20px;
            user-select: none;
          }
          .glass-panel {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(28px);
            -webkit-backdrop-filter: blur(28px);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 28px;
            padding: 48px 44px;
            text-align: center;
            max-width: 460px;
            width: 100%;
            box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6), 0 0 50px rgba(13, 110, 253, 0.2);
            position: relative;
            z-index: 10;
          }
          .logo-img {
            height: 52px;
            max-width: 200px;
            object-fit: contain;
            margin-bottom: 26px;
            filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.4));
          }
          .icon-ring {
            width: 86px;
            height: 86px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(13, 110, 253, 0.25), rgba(0, 212, 255, 0.15));
            border: 2px solid rgba(0, 212, 255, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 22px;
            position: relative;
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.35);
          }
          .icon-ring::before {
            content: '';
            position: absolute;
            inset: -8px;
            border-radius: 50%;
            border: 1.5px dashed rgba(0, 212, 255, 0.35);
            animation: spin 12s linear infinite;
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
          .title {
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #ffffff 30%, #90caf9 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .subtitle {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 22px;
          }
          .user-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            border-radius: 20px;
            background: rgba(13, 110, 253, 0.2);
            border: 1px solid rgba(13, 110, 253, 0.4);
            color: #64b5f6;
            font-size: 13.5px;
            font-weight: 500;
            margin-bottom: 26px;
          }
          .status-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: rgba(255, 255, 255, 0.65);
            font-size: 13px;
          }
          .dot-loader {
            display: flex;
            gap: 6px;
          }
          .dot-loader span {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #00d4ff;
            animation: bounce 1.2s infinite ease-in-out;
          }
          .dot-loader span:nth-child(2) { animation-delay: 0.2s; }
          .dot-loader span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div className="glass-panel">
          <img src="/assets/images/Jabil-Logo.png" alt="Jabil" className="logo-img" />
          <div className="icon-ring">
            <CheckCircle2 size={42} color="#00d4ff" />
          </div>
          <h2 className="title">Welcome Back</h2>
          <p className="subtitle">Active session detected. Preparing your dashboard...</p>
          <div className="user-badge">
            <User size={14} />
            <span>{user?.first_name || user?.user_id || 'Operator'}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
            <span style={{ color: '#00d4ff', textTransform: 'uppercase' }}>{user?.role || 'OPERATOR'}</span>
          </div>
          <div className="status-indicator">
            <div className="dot-loader">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Redirecting to workspace</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-root">
      <style jsx global>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* Override Chrome/Edge/Safari white autofill background */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0e172a inset !important;
          box-shadow: 0 0 0 1000px #0e172a inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #00d4ff !important;
          border-radius: 11px !important;
          transition: background-color 99999s ease-in-out 0s !important;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.06); }
        }
        @keyframes shake-anim {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        @keyframes shimmer-line {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <style jsx>{`
        .login-root {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          display: flex;
          background: #060a12;
          color: #f1f5f9;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
          user-select: none;
        }

        /* Kardex Warehouse Ambient Background */
        .ambient-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
          background: 
            linear-gradient(135deg, rgba(6, 10, 18, 0.88) 0%, rgba(10, 18, 36, 0.78) 45%, rgba(6, 10, 18, 0.88) 100%),
            url('/assets/images/kardex-warehouse-ai.jpg') center/cover no-repeat;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.35;
        }
        .orb-1 {
          width: 550px;
          height: 550px;
          top: -120px;
          left: -80px;
          background: radial-gradient(circle, #0d6efd 0%, rgba(13, 110, 253, 0) 70%);
          animation: pulse-subtle 8s infinite ease-in-out;
        }
        .orb-2 {
          width: 580px;
          height: 580px;
          bottom: -140px;
          right: -80px;
          background: radial-gradient(circle, #00b4d8 0%, rgba(0, 180, 216, 0) 70%);
          animation: pulse-subtle 10s infinite ease-in-out reverse;
        }
        .grid-mesh {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black 45%, transparent 88%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 45%, transparent 88%);
        }

        /* Container Split */
        .split-container {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 1360px;
          margin: 0 auto;
          height: 100vh;
          padding: 20px 40px;
          overflow: hidden;
        }

        /* Left Branding Showcase */
        .brand-panel {
          flex: 1.1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 30px 0 10px;
          position: relative;
          max-width: 600px;
        }
        @media (max-width: 991px) {
          .brand-panel {
            display: none;
          }
        }
        .brand-logo-hero {
          height: 48px;
          width: auto;
          max-width: 190px;
          object-fit: contain;
          margin-bottom: 18px;
          filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.45));
        }
        .badge-system {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(13, 110, 253, 0.2);
          border: 1px solid rgba(13, 110, 253, 0.4);
          color: #60a5fa;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-bottom: 14px;
          width: fit-content;
        }
        .hero-title {
          font-size: 36px;
          font-weight: 800;
          line-height: 1.18;
          color: #ffffff;
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .gradient-text {
          background: linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #60a5fa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-desc {
          font-size: 14px;
          line-height: 1.55;
          color: #cbd5e1;
          max-width: 500px;
          margin-bottom: 20px;
        }

        /* Feature Cards */
        .features-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 520px;
        }
        .feature-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 16px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: all 0.25s ease;
        }
        .feature-card:hover {
          background: rgba(15, 23, 42, 0.85);
          border-color: rgba(0, 212, 255, 0.35);
          transform: translateX(4px);
        }
        .feature-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(13, 110, 253, 0.18);
          border: 1px solid rgba(13, 110, 253, 0.35);
          color: #00d4ff;
        }
        .feature-title {
          font-size: 14px;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 2px;
        }
        .feature-desc {
          font-size: 12.5px;
          color: #94a3b8;
        }

        /* Right Auth Panel */
        .form-panel {
          flex: 0.95;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          position: relative;
        }
        .login-card {
          width: 100%;
          max-width: 440px;
          border-radius: 24px;
          background: rgba(10, 16, 30, 0.86);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 
            0 25px 60px rgba(0, 0, 0, 0.65),
            0 0 40px rgba(13, 110, 253, 0.15);
          overflow: hidden;
          position: relative;
        }
        .login-card.shake {
          animation: shake-anim 0.5s ease;
        }
        .card-top-bar {
          height: 3.5px;
          background: linear-gradient(90deg, #0d6efd 0%, #00d4ff 50%, #0d6efd 100%);
          background-size: 200% 100%;
          animation: shimmer-line 3s infinite linear;
        }
        .card-body-content {
          padding: 28px 34px 22px;
        }
        @media (max-width: 576px) {
          .card-body-content {
            padding: 22px 18px 18px;
          }
        }
        .mobile-brand-header {
          display: none;
          text-align: center;
          margin-bottom: 16px;
        }
        @media (max-width: 991px) {
          .mobile-brand-header {
            display: block;
          }
        }
        .mobile-logo {
          height: 40px;
          width: auto;
          max-width: 150px;
          object-fit: contain;
          margin-bottom: 6px;
        }

        .card-header-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0d6efd 0%, #0096c7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          box-shadow: 0 6px 18px rgba(13, 110, 253, 0.4);
          color: #ffffff;
        }
        .card-title {
          font-size: 23px;
          font-weight: 700;
          color: #ffffff;
          text-align: center;
          margin-bottom: 4px;
        }
        .card-subtitle {
          font-size: 13px;
          color: #94a3b8;
          text-align: center;
          margin-bottom: 18px;
        }

        /* Input Controls */
        .form-group-custom {
          margin-bottom: 14px;
        }
        .field-label {
          display: block;
          font-size: 12.5px;
          font-weight: 500;
          color: #cbd5e1;
          margin-bottom: 5px;
        }
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.05);
          border: 1.5px solid rgba(255, 255, 255, 0.12);
          transition: all 0.2s ease;
        }
        .input-wrapper.focused {
          border-color: #00d4ff;
          background: rgba(255, 255, 255, 0.09);
          box-shadow: 0 0 16px rgba(0, 212, 255, 0.25);
        }
        .input-icon-left {
          position: absolute;
          left: 14px;
          color: #64748b;
          pointer-events: none;
          transition: color 0.2s;
          z-index: 2;
        }
        .input-wrapper.focused .input-icon-left {
          color: #00d4ff;
        }
        .custom-input {
          width: 100%;
          height: 46px;
          padding: 0 44px 0 44px;
          background: transparent !important;
          border: none;
          outline: none;
          color: #ffffff !important;
          font-size: 14.5px;
          font-family: inherit;
          border-radius: 11px;
          position: relative;
          z-index: 1;
        }
        .custom-input:-webkit-autofill,
        .custom-input:-webkit-autofill:hover,
        .custom-input:-webkit-autofill:focus,
        .custom-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0e172a inset !important;
          box-shadow: 0 0 0 1000px #0e172a inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #00d4ff !important;
          transition: background-color 99999s ease-in-out 0s !important;
          border-radius: 11px !important;
        }
        .custom-input::placeholder {
          color: rgba(148, 163, 184, 0.5);
        }
        .toggle-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: color 0.2s;
          z-index: 2;
        }
        .toggle-btn:hover {
          color: #00d4ff;
        }

        /* Options Row */
        .options-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .remember-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #94a3b8;
          cursor: pointer;
          user-select: none;
        }
        .custom-checkbox {
          width: 18px;
          height: 18px;
          border-radius: 5px;
          border: 1.5px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .custom-checkbox.checked {
          background: #0d6efd;
          border-color: #0d6efd;
          box-shadow: 0 0 10px rgba(13, 110, 253, 0.45);
        }

        /* Submit Button */
        .btn-submit {
          width: 100%;
          height: 48px;
          border: none;
          outline: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #0d6efd 0%, #0096c7 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(13, 110, 253, 0.38);
          transition: all 0.25s ease;
        }
        .btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(13, 110, 253, 0.52);
          background: linear-gradient(135deg, #1a7bff 0%, #00b4d8 100%);
        }
        .btn-submit:active:not(:disabled) {
          transform: translateY(1px);
        }
        .btn-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Error Banner */
        .alert-error {
          padding: 10px 12px;
          border-radius: 9px;
          background: rgba(220, 53, 69, 0.18);
          border: 1px solid rgba(220, 53, 69, 0.4);
          color: #ff6b6b;
          font-size: 12.5px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Success Overlay Inside Card */
        .success-overlay {
          position: absolute;
          inset: 0;
          background: rgba(10, 16, 30, 0.96);
          backdrop-filter: blur(18px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 20;
          padding: 24px;
          text-align: center;
        }
        .success-icon-pop {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
          border: 2px solid #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
          margin-bottom: 14px;
          box-shadow: 0 0 28px rgba(16, 185, 129, 0.45);
        }

        /* Card Footer */
        .card-footer-sec {
          padding: 12px 30px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11.5px;
          color: #94a3b8;
        }
      `}</style>

      {/* Kardex Warehouse Ambient background effect */}
      <div className="ambient-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="grid-mesh"></div>
      </div>

      <div className="split-container">
        {/* Left Side: Jabil + Kardex Branding Showcase */}
        <div className="brand-panel">
          <div className="badge-system">
            <Sparkles size={14} color="#00d4ff" />
            <span>KARDEX AUTOMATION SYSTEM</span>
          </div>

          <img src="/assets/images/Jabil-Logo.png" alt="Jabil" className="brand-logo-hero" />

          <h1 className="hero-title">
            Smart Warehouse <br />
            <span className="gradient-text">Adapter Validation</span>
          </h1>

          <p className="hero-desc">
            Enterprise Automated Storage &amp; Retrieval System. Precision Handling Unit verification,
            serial number tracking, and automated Jabil TIS/MES synchronization.
          </p>

          <div className="features-list">
            <div className="feature-card">
              <div className="feature-icon-box">
                <Boxes size={22} />
              </div>
              <div>
                <div className="feature-title">Automated Put Validation</div>
                <div className="feature-desc">HU verification, model validation &amp; Kardex rack bin assignment</div>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box" style={{ background: 'rgba(0, 180, 216, 0.18)', borderColor: 'rgba(0, 180, 216, 0.35)', color: '#00b4d8' }}>
                <Zap size={22} />
              </div>
              <div>
                <div className="feature-title">Pick &amp; Order Fulfillment</div>
                <div className="feature-desc">Guided tray retrieval, bin position indicator &amp; live quantity adjustment</div>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box" style={{ background: 'rgba(16, 185, 129, 0.18)', borderColor: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }}>
                <Layers size={22} />
              </div>
              <div>
                <div className="feature-title">MES Live Telemetry</div>
                <div className="feature-desc">Direct SOAP integration with Jabil MES &amp; real-time transactional audit logs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: High-Tech Glassmorphic Portal */}
        <div className="form-panel">
          <div className={`login-card ${shake ? 'shake' : ''}`}>
            <div className="card-top-bar"></div>

            <div className="card-body-content">
              {/* Mobile View Header */}
              <div className="mobile-brand-header">
                <img src="/assets/images/Jabil-Logo.png" alt="Jabil" className="mobile-logo" />
                <div style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 600 }}>
                  ADAPTER VALIDATION
                </div>
              </div>

              <div className="card-header-icon">
                <Lock size={26} />
              </div>

              <h2 className="card-title">Sign In</h2>
              <p className="card-subtitle">Enter your employee credentials to continue</p>

              {error && (
                <div className="alert-error" role="alert">
                  <Shield size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate autoComplete="off">
                <div className="form-group-custom">
                  <label htmlFor="user_id" className="field-label">
                    User Id / Employee ID
                  </label>
                  <div className={`input-wrapper ${focusedField === 'user_id' ? 'focused' : ''}`}>
                    <User size={18} className="input-icon-left" />
                    <input
                      type="text"
                      id="user_id"
                      className="custom-input"
                      placeholder="e.g. 1012345"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      onFocus={() => setFocusedField('user_id')}
                      onBlur={() => setFocusedField(null)}
                      disabled={submitting || loginSuccess}
                      required
                    />
                  </div>
                </div>

                <div className="form-group-custom">
                  <label htmlFor="password" className="field-label">
                    Password
                  </label>
                  <div className={`input-wrapper ${focusedField === 'password' ? 'focused' : ''}`}>
                    <Lock size={18} className="input-icon-left" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      className="custom-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      disabled={submitting || loginSuccess}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      disabled={submitting || loginSuccess}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="options-row">
                  <label
                    className="remember-checkbox-label"
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    <div className={`custom-checkbox ${rememberMe ? 'checked' : ''}`}>
                      {rememberMe && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span>Remember my User ID</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting || loginSuccess}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {loginSuccess && (
                <div className="success-overlay">
                  <div className="success-icon-pop">
                    <CheckCircle2 size={38} />
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Authenticated!
                  </h3>
                  <p style={{ fontSize: '13.5px', color: '#10b981', margin: 0 }}>
                    Opening warehouse workspace...
                  </p>
                </div>
              )}
            </div>

            <div className="card-footer-sec">
              <Shield size={14} color="#10b981" />
              <span>Enterprise-grade encryption &amp; secure session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
