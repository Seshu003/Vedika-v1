'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookOpen, Award, FileText, FolderOpen } from 'lucide-react';
import { T } from '@/lib/lms-data';

// Import subcomponents
import CoursePage from '@/components/CoursePage';
import StudentQuizzesPage from '../quizzes/page';
import StudentAssignmentsPage from '../assignments/page';
import ResourcesPage from '../resources/page';

function CoursesTabsContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const activeTab = searchParams.get('tab') || 'explore';
  const [completed, setCompleted] = useState({});

  const setTab = (newTab) => {
    router.push(`/courses?tab=${newTab}`);
  };

  const tabs = [
    { id: 'explore',     label: 'Explore Courses', Icon: BookOpen },
    { id: 'quizzes',     label: 'Quizzes',         Icon: Award },
    { id: 'assignments', label: 'Assignments',     Icon: FileText },
    { id: 'resources',   label: 'Resources Hub',   Icon: FolderOpen },
  ];

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)' }}>
      {/* Premium Horizontal HTML-like Tab Bar */}
      <div style={{
        background: T.s1,
        borderBottom: `1px solid ${T.border}`,
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 99,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          maxWidth: 1200,
          margin: '0 auto',
          overflowX: 'auto',
        }}>
          {tabs.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: active ? `1px solid ${T.accent}30` : '1px solid transparent',
                  background: active ? `${T.accent}12` : 'transparent',
                  color: active ? T.accent : T.muted,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.s2; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents Area */}
      <div style={{ width: '100%' }}>
        {activeTab === 'explore' && <CoursePage completed={completed} />}
        {activeTab === 'quizzes' && <StudentQuizzesPage />}
        {activeTab === 'assignments' && <StudentAssignmentsPage />}
        {activeTab === 'resources' && <ResourcesPage />}
      </div>
    </div>
  );
}

export default function CoursesRoute() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(155, 110, 248, 0.2)', borderTopColor: '#38BDF8', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <CoursesTabsContainer />
    </Suspense>
  );
}
