'use client';

import { useState } from 'react';
import CoursePage from '@/components/CoursePage';

export default function CoursesRoute() {
  const [completed, setCompleted] = useState({});
  return <CoursePage completed={completed} />;
}
