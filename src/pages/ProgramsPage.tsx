import { useAuth } from '../context/AuthContext';
import { programsApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Users, DollarSign, Briefcase, FileText, ExternalLink } from 'lucide-react';

function DocumentList({ raw }: { raw: string | null }) {
  if (!raw) return null;
  let docs: string[] = [];
  try { docs = JSON.parse(raw); } catch { return null; }
  if (docs.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-2">
        <FileText className="w-3.5 h-3.5 text-gray-500" />
        <p className="text-xs font-semibold text-gray-700">Documents Required to Apply</p>
      </div>
      <ul className="space-y-1">
        {docs.map((doc, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            {doc}
          </li>
        ))}
      </ul>
    </div>
  );
}

function safeLink(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

export default function ProgramsPage() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.getAll(token!),
    enabled: !!token,
  });

  const programs = data?.programs || [];

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="text-center text-red-500 mt-16">
      <p className="font-medium">Failed to load programs</p>
      <p className="text-sm text-gray-500 mt-1">Make sure the backend server is running</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Government Programs</h1>
      <p className="text-gray-500 text-sm mb-6">{programs.length} active programs available</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {programs.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all hover:border-blue-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <span className="inline-block mt-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {p.category}
                </span>
              </div>
              <div className="flex items-center justify-center w-9 h-9 bg-blue-50 rounded-lg flex-shrink-0">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{p.description}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(p.min_age || p.max_age) && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Users className="w-3.5 h-3.5" />
                  Age: {p.min_age}–{p.max_age} yrs
                </div>
              )}
              {p.max_income > 0 && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <DollarSign className="w-3.5 h-3.5" />
                  Max: ₹{Number(p.max_income).toLocaleString('en-IN')}
                </div>
              )}
              {p.employment_status !== 'any' && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Briefcase className="w-3.5 h-3.5" />
                  {p.employment_status}
                </div>
              )}
            </div>

            {(p.disability_required || p.citizenship_required) && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                {p.citizenship_required && (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Indian Citizen required</span>
                )}
                {p.disability_required && (
                  <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">Divyangjan required</span>
                )}
              </div>
            )}
            {safeLink(p.official_link) && (
              <a href={safeLink(p.official_link)!} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                <ExternalLink className="w-3 h-3" />
                Official Website
              </a>
            )}
            <DocumentList raw={p.documents_required} />
          </div>
        ))}
      </div>
    </div>
  );
}
