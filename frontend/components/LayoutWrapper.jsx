'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import AdminSidebar from './AdminSidebar';
import { T } from '@/lib/lms-data';
import PersonalizedBot from './PersonalizedBot';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [showAgeModal, setShowAgeModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar_collapsed') === 'true';
      setSidebarCollapsed(stored);
    }
  }, []);

  const handleToggleCollapse = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(newState));
    }
  };

  useEffect(() => {
    // Read the user object synchronously from localStorage
    const storedUser = localStorage.getItem('frappe_user');
    let currentUser = null;
    if (storedUser) {
      try {
        currentUser = JSON.parse(storedUser);
      } catch (e) {
        localStorage.removeItem('frappe_user');
      }
    }

    const isAuthPage = pathname === '/login' || pathname === '/users' || pathname === '/admin/login' || pathname.startsWith('/auth');

    if (!currentUser) {
      if (!isAuthPage) {
        // Redirect to unified login page if not logged in
        setUser(null);
        setLoading(true);
        router.replace('/login');
        return;
      }
    } else {
      // User is logged in
      if (pathname === '/users' || pathname === '/admin/login' || pathname === '/login') {
        // Redirect logged-in users away from auth pages
        setLoading(true);
        if (currentUser.role === 'Administrator') {
          router.replace('/admin');
        } else {
          router.replace('/');
        }
        return;
      } else {
        // Logged-in page validation
        if (currentUser.role === 'Administrator') {
          if (!pathname.startsWith('/admin')) {
            setLoading(true);
            router.replace('/admin');
            return;
          }
        } else {
          if (pathname.startsWith('/admin')) {
            setLoading(true);
            router.replace('/');
            return;
          }
        }
      }
    }

    // If no redirect is needed, set the local state and stop loading
    setUser(currentUser);
    setLoading(false);

    // Show age onboarding modal if logged in but age is not verified
    if (currentUser && !isAuthPage) {
      const storedAge = localStorage.getItem('lms-user-age');
      if (!storedAge) {
        setShowAgeModal(true);
      }
    } else {
      setShowAgeModal(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    // Configure layout background dynamically matching theme
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.backgroundColor = theme === 'dark' ? '#07080F' : '#F9FAFB';
  }, []);

  // Sync route path to bot context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__vyomanta_context = {
        page: pathname,
        title: document.title || 'AI TUTOR Workspace'
      };
    }
  }, [pathname]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        width: '100vw',
        minWidth: '100vw',
        minHeight: '100vh',
        background: 'var(--bg)',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text)',
        fontFamily: 'var(--font-outfit), sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Loading AI TUTOR Portal...</div>
        </div>
      </div>
    );
  }

  const isAuthPage = pathname === '/login' || pathname === '/users' || pathname === '/admin/login' || pathname.startsWith('/auth');

  // Auth pages (like /login) render directly without a sidebar
  if (isAuthPage || !user) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>{children}<PersonalizedBot /></div>;
  }

  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', width: '100%' }}>
      {isAdminRoute ? (
        <AdminSidebar isCollapsed={sidebarCollapsed} onToggleCollapse={handleToggleCollapse} />
      ) : (
        <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={handleToggleCollapse} />
      )}
      <div className="sidebar-content-area" style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>
        {children}
      </div>
      <PersonalizedBot />

      {/* Age Onboarding modal */}
      {showAgeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(7, 8, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          fontFamily: 'var(--font-outfit), sans-serif'
        }}>
          <div style={{
            width: 420,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            color: '#f8fafc'
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #38BDF8, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <span style={{ fontSize: 24 }}>🤖</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Meet VEDIKA!</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 20 }}>
              Hi! I am VEDIKA, your AI companion. Select your age group so I can personalize my tutoring explanations and interactions for you:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {[
                { key: '6-10', label: '🎒 Elementary School (Ages 6-10)' },
                { key: '11-14', label: '📖 Middle School (Ages 11-14)' },
                { key: '15+', label: '💻 High School & Above (Ages 15+)' }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    localStorage.setItem('lms-user-age', opt.key);
                    setShowAgeModal(false);
                    // Dispatch storage event to force component websocket connection updates
                    window.dispatchEvent(new Event('storage'));
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 10,
                    color: '#f8fafc',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                    e.currentTarget.style.borderColor = '#38BDF8';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
