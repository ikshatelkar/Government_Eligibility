import { useAuth } from '../context/AuthContext';
import { eligibilityApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, BarChart2 } from 'lucide-react';

export default function ResultsPage() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-results'],
    queryFn: () => eligibilityApi.getResults(token!),
    enabled: !!token,
  });

  const results = data?.results || [];

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Eligibility Results</h1>
      <p className="text-gray-500 text-sm mb-6">History of your eligibility checks</p>

      {error ? (
        <div className="text-center text-red-500 mt-8">Failed to load results. Is the backend running?</div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-6 h-6 text-gray-400" />
          </div>
          <p className="font-medium text-gray-900">No results yet</p>
          <p className="text-sm text-gray-500 mt-1">Run an eligibility check to see results here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Program</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Age</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Income</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">ML Score</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Result</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-900">{r.program_name}</td>
                  <td className="px-5 py-4 text-gray-500">{r.age}</td>
                  <td className="px-5 py-4 text-gray-500">₹{Number(r.income).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4 text-gray-500">
                    {r.ml_score !== null ? `${(r.ml_score * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {r.is_eligible
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Eligible</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full"><XCircle className="w-3 h-3" /> Not Eligible</span>}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {new Date(r.checked_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
