import { useAuth } from '../context/AuthContext';
import { applicationsApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, Eye } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700 bg-amber-100', icon: Clock },
  under_review: { label: 'Under Review', color: 'text-blue-700 bg-blue-100', icon: Eye },
  approved: { label: 'Approved', color: 'text-green-700 bg-green-100', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-700 bg-red-100', icon: XCircle },
};

export default function ApplicationsPage() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => applicationsApi.getMy(token!),
    enabled: !!token,
  });

  const applications = data?.applications || [];

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Applications</h1>
      <p className="text-gray-500 text-sm mb-6">Track the status of your benefit applications</p>

      {error ? (
        <div className="text-center text-red-500 mt-8">
          <p>Failed to load applications. Is the backend running?</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="font-medium text-gray-900">No applications yet</p>
          <p className="text-sm text-gray-500 mt-1">Check your eligibility and apply for programs</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Program</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app: any) => {
                const status = statusConfig[app.status] || statusConfig.pending;
                const Icon = status.icon;
                return (
                  <tr key={app.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-900">{app.program_name}</td>
                    <td className="px-5 py-4 text-gray-500">{app.category}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                        <Icon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(app.submitted_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
