import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { AdminLogoutButton } from './logout-button';
import { canApplyToJobs } from '@/lib/profile';
import { DeleteUserButton } from './delete-user-button';

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      applications: {
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { applications: true } },
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Pull Jobs Admin</h1>
            <p className="text-sm text-zinc-500">{users.length} Telegram users</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
              Home
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="space-y-4">
          {users.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
              No users yet. Users appear here after they message the Telegram bot.
            </p>
          ) : (
            users.map((user: any) => (
              <details
                key={user.id}
                className="group rounded-xl border border-zinc-200 bg-white shadow-sm transition-all overflow-hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-50 list-none">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium">
                      {(user.firstName?.[0] || 'U').toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-zinc-900">
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}
                      </h2>
                      <p className="text-xs text-zinc-500">ID: {user.telegramChatId} • {user._count.applications} applications</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        canApplyToJobs(user)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {canApplyToJobs(user) ? 'Ready' : 'Incomplete'}
                    </span>
                    <DeleteUserButton userId={user.id} userName={[user.firstName, user.lastName].filter(Boolean).join(' ') || user.telegramChatId} />
                    <svg className="w-5 h-5 text-zinc-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>

                <div className="px-6 pb-6 border-t border-zinc-100 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                    {/* User Details */}
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Profile Details</h3>
                      <dl className="space-y-3 text-sm">
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Full Name</dt>
                          <dd className="font-medium text-zinc-900">{[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Email</dt>
                          <dd className="font-medium text-zinc-900">{user.email || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Phone</dt>
                          <dd className="font-medium text-zinc-900">{user.phone || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Location</dt>
                          <dd className="font-medium text-zinc-900">{user.location || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Current CTC</dt>
                          <dd className="font-medium text-zinc-900">{user.currentCtc || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Expected CTC</dt>
                          <dd className="font-medium text-zinc-900">{user.expectedCtc || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-50">
                          <dt className="text-zinc-500">Target Role</dt>
                          <dd className="font-medium text-zinc-900">{user.targetRole || '—'}</dd>
                        </div>
                        <div className="flex justify-between py-1">
                          <dt className="text-zinc-500">Resume</dt>
                          <dd className="font-medium">
                            {user.resumeUrl ? (
                              <a href={user.resumeUrl} className="text-indigo-600 hover:text-indigo-800 underline" target="_blank" rel="noreferrer">
                                Open PDF
                              </a>
                            ) : (
                              'Not uploaded'
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Applications List */}
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Application History</h3>
                      {user.applications.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">No applications logged yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {user.applications.map((app: any) => (
                            <div key={app.id} className="p-3 rounded-lg border border-zinc-100 bg-zinc-50">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-semibold text-zinc-900">{app.jobTitle}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                  app.status === 'APPLIED' ? 'bg-emerald-100 text-emerald-700' :
                                  app.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                  'bg-zinc-200 text-zinc-600'
                                }`}>
                                  {app.status}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-600">{app.companyName}</p>
                              {app.errorMessage && (
                                <p className="mt-2 text-[11px] text-red-500 leading-tight">Error: {app.errorMessage}</p>
                              )}
                              <p className="mt-2 text-[10px] text-zinc-400">
                                Applied: {new Date(app.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {user.experienceSummary && (
                    <div className="mt-8 p-4 rounded-xl bg-zinc-900 text-zinc-300">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Experience Summary</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{user.experienceSummary}</p>
                    </div>
                  )}
                </div>
              </details>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
