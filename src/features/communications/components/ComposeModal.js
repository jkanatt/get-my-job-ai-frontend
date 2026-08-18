'use client';

import { useCompose } from '@/app/context/ComposeContext';
import ComposeWindow from './ComposeWindow';

export default function ComposeModal() {
  const { sessions } = useCompose();
  
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-row-reverse items-end gap-4 pointer-events-none">
      {sessions.map(session => (
        <ComposeWindow key={session.id} session={session} />
      ))}
    </div>
  );
}
