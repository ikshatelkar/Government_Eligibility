import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { eligibilityApi, programsApi } from '../services/api';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface EligibilityResult {
  program: string;
  program_id?: number;
  is_eligible: boolean;
  ml_score: number | null;
  message: string;
}

interface AllResult {
  program_id: number;
  program_name: string;
  category: string;
  is_eligible: boolean;
  official_link?: string;
  state?: string;
  documents_required?: string;
}

export default function CheckEligibilityPage() {
  const { token } = useAuth();
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [allResults, setAllResults] = useState<AllResult[]>([]);

  const [form, setForm] = useState({
    age: '',
    income: '',
    employment_status: 'unemployed',
    occupation: 'other',
    has_disability: false,
    is_citizen: true,
    gender: 'male',
    caste: 'General',
    state: 'All India',
  });

  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.getAll(token!),
    enabled: !!token,
  });

  const programs = programsData?.programs || [];

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.age || !form.income) {
      toast.error('Please fill in age and income');
      return;
    }
    setLoading(true);
    setResult(null);
    setAllResults([]);

    try {
      const payload = {
        age: parseInt(form.age),
        income: parseFloat(form.income),
        employment_status: form.employment_status,
        occupation: form.occupation,
        has_disability: form.has_disability,
        is_citizen: form.is_citizen,
        gender: form.gender,
        caste: form.caste,
        state: form.state,
        ...(mode === 'single' && selectedProgram ? { program_id: parseInt(selectedProgram) } : {}),
      };

      if (mode === 'single') {
        if (!selectedProgram) { toast.error('Please select a program'); setLoading(false); return; }
        const data = await eligibilityApi.check(payload, token!);
        setResult({ ...data, program_id: parseInt(selectedProgram) });
      } else {
        const data = await eligibilityApi.checkAll(payload, token!);
        setAllResults(data.results);
      }
    } catch (err: any) {
      toast.error(err.message || 'Check failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Check Eligibility</h1>
      <p className="text-gray-500 text-sm mb-6">Enter your details to find out which programs you qualify for.</p>

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {(['all', 'single'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'all' ? 'All Programs' : 'Specific Program'}
          </button>
        ))}
      </div>

      <form onSubmit={handleCheck} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
            <input
              type="number" min="1" max="120" required
              value={form.age}
              onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
              placeholder="e.g. 35"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Annual Income (₹)</label>
            <input
              type="number" min="0" required
              value={form.income}
              onChange={e => setForm(p => ({ ...p, income: e.target.value }))}
              placeholder="e.g. 180000"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Employment Status</label>
          <div className="relative">
            <select
              value={form.employment_status}
              onChange={e => setForm(p => ({ ...p, employment_status: e.target.value }))}
              className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="employed">Employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="self_employed">Self-Employed</option>
              <option value="retired">Retired</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Occupation</label>
          <div className="relative">
            <select
              value={form.occupation}
              onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))}
              className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="farmer">Farmer / Agricultural Worker</option>
              <option value="student">Student</option>
              <option value="business">Business Owner / Entrepreneur</option>
              <option value="street_vendor">Street Vendor</option>
              <option value="unorganised_worker">Daily Wage / Unorganised Sector Worker</option>
              <option value="armed_forces">Ex-Serviceman / Armed Forces</option>
              <option value="government_employee">Government Employee</option>
              <option value="private_employee">Private Sector Employee</option>
              <option value="homemaker">Homemaker</option>
              <option value="other">Other / Not Listed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.has_disability}
              onChange={e => setForm(p => ({ ...p, has_disability: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Has Disability</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_citizen}
              onChange={e => setForm(p => ({ ...p, is_citizen: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Indian Citizen</span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
            <div className="relative">
              <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category / Caste</label>
            <div className="relative">
              <select value={form.caste} onChange={e => setForm(p => ({ ...p, caste: e.target.value }))}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
            <div className="relative">
              <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="All India">All India</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                <option value="Assam">Assam</option>
                <option value="Bihar">Bihar</option>
                <option value="Chhattisgarh">Chhattisgarh</option>
                <option value="Goa">Goa</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Haryana">Haryana</option>
                <option value="Himachal Pradesh">Himachal Pradesh</option>
                <option value="Jharkhand">Jharkhand</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Kerala">Kerala</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Manipur">Manipur</option>
                <option value="Meghalaya">Meghalaya</option>
                <option value="Mizoram">Mizoram</option>
                <option value="Nagaland">Nagaland</option>
                <option value="Odisha">Odisha</option>
                <option value="Punjab">Punjab</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Sikkim">Sikkim</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Telangana">Telangana</option>
                <option value="Tripura">Tripura</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Uttarakhand">Uttarakhand</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Delhi">Delhi</option>
                <option value="Jammu & Kashmir">Jammu &amp; Kashmir</option>
                <option value="Ladakh">Ladakh</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {mode === 'single' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Program</label>
            <div className="relative">
              <select
                value={selectedProgram}
                onChange={e => setSelectedProgram(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Choose a program --</option>
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Checking...' : 'Check Eligibility'}
        </button>
      </form>

      {/* Single result */}
      {result && (
        <div className={`mt-6 rounded-xl border-2 p-6 ${result.is_eligible ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-3 mb-3">
            {result.is_eligible
              ? <CheckCircle className="w-6 h-6 text-green-600" />
              : <XCircle className="w-6 h-6 text-red-500" />}
            <h3 className={`font-semibold text-lg ${result.is_eligible ? 'text-green-800' : 'text-red-800'}`}>
              {result.is_eligible ? 'Eligible' : 'Not Eligible'}
            </h3>
          </div>
          <p className={`text-sm ${result.is_eligible ? 'text-green-700' : 'text-red-700'}`}>{result.message}</p>
          {result.ml_score !== null && (
            <p className="text-xs text-gray-500 mt-2">ML Confidence Score: {(result.ml_score * 100).toFixed(1)}%</p>
          )}
          {result.is_eligible && (result as any).official_link && (
            <a href={(result as any).official_link} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-600 hover:underline">
              View Official Scheme →
            </a>
          )}
        </div>
      )}

      {/* All results */}
      {allResults.length > 0 && (
        <div className="mt-6">
          {allResults.filter(r => r.is_eligible).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <XCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No eligible schemes found</p>
              <p className="text-sm text-gray-400 mt-1">Try updating your profile details or checking with different inputs.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h2 className="text-base font-semibold text-gray-900">
                  You are eligible for {allResults.filter(r => r.is_eligible).length} scheme{allResults.filter(r => r.is_eligible).length !== 1 ? 's' : ''}
                </h2>
              </div>
              <div className="space-y-3">
                {allResults.filter(r => r.is_eligible).map(r => (
                  <div key={r.program_id} className="bg-white rounded-lg border border-green-200 px-4 py-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.program_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.category}{r.state && r.state !== 'All India' ? ` · ${r.state}` : ''}</p>
                      {r.official_link && (() => {
                        const link = r.official_link.startsWith('http') ? r.official_link : `https://${r.official_link.replace(/^\/+/, '')}`;
                        return <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Apply Online →</a>;
                      })()}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex-shrink-0 ml-3">
                        <CheckCircle className="w-3 h-3" /> Eligible
                      </span>
                    </div>
                    {r.documents_required && (() => {
                      try {
                        const docs: string[] = JSON.parse(r.documents_required);
                        if (docs.length === 0) return null;
                        return (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">Documents required to apply:</p>
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
                      } catch { return null; }
                    })()}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
