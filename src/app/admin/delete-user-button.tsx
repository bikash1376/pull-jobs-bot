'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you absolutely sure you want to delete ${userName}? This will remove all their data and application history.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {isDeleting ? 'Deleting...' : 'Delete User'}
    </button>
  );
}
