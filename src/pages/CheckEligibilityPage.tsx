import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { eligibilityApi, programsApi } from '../services/api';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, ChevronDown, Trophy, ChevronUp, List, Baby } from 'lucide-react';
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
  match_score: number;
  official_link?: string;
  state?: string;
  caste?: string;
  ministry?: string;
  documents_required?: string;
  how_to_apply?: string;
  benefits?: string;
  tags?: string;
}

export default function CheckEligibilityPage() {
  const { token } = useAuth();
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [allResults, setAllResults] = useState<AllResult[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [forChild, setForChild] = useState(false);

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
    education: 'any',
    location_type: 'any',
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
    setShowAll(false);

    try {
      const payload = {
        age: parseInt(form.age),
        income: parseFloat(form.income),
        employment_status: forChild ? 'unemployed' : form.employment_status,
        occupation: forChild ? 'student' : form.occupation,
        has_disability: form.has_disability,
        is_citizen: form.is_citizen,
        gender: form.gender,
        caste: form.caste,
        state: form.state,
        education: form.education,
        location_type: form.location_type,
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

        {/* Child mode toggle */}
        <div
          onClick={() => setForChild(v => !v)}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
            forChild
              ? 'bg-blue-50 border-blue-300 text-blue-800'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${forChild ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${forChild ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <Baby className={`w-4 h-4 flex-shrink-0 ${forChild ? 'text-blue-600' : 'text-gray-400'}`} />
          <div>
            <p className="text-sm font-medium leading-none">Checking for a child (under 18)</p>
            {forChild && (
              <p className="text-xs text-blue-600 mt-1">Employment &amp; occupation fields hidden — child welfare &amp; education schemes enabled</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {forChild ? "Child's Age" : 'Age'}
            </label>
            <input
              type="number" min="0" max="120" required
              value={form.age}
              onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
              placeholder={forChild ? 'e.g. 5' : 'e.g. 35'}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {forChild ? 'Family Annual Income (₹)' : 'Annual Income (₹)'}
            </label>
            <input
              type="number" min="0" required
              value={form.income}
              onChange={e => setForm(p => ({ ...p, income: e.target.value }))}
              placeholder="e.g. 180000"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Only show employment/occupation for adults */}
        {!forChild && (
          <>
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
          </>
        )}

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.has_disability}
              onChange={e => setForm(p => ({ ...p, has_disability: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{forChild ? 'Child has Disability' : 'Has Disability'}</span>
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

        {/* Education & Location row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Education Level</label>
            <div className="relative">
              <select value={form.education} onChange={e => setForm(p => ({ ...p, education: e.target.value }))}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="any">Select (optional)</option>
                <option value="Illiterate">Illiterate / No formal education</option>
                <option value="Primary">Primary (up to 5th)</option>
                <option value="Secondary">Secondary (up to 10th)</option>
                <option value="Higher Secondary">Higher Secondary (12th)</option>
                <option value="Graduate">Graduate (Degree)</option>
                <option value="Post-Graduate">Post-Graduate / PhD</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Area Type</label>
            <div className="relative">
              <select value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value }))}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="any">Select (optional)</option>
                <option value="rural">Rural (Village / Gram Panchayat)</option>
                <option value="semi-urban">Semi-Urban (Small town)</option>
                <option value="urban">Urban (City / Metro)</option>
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
      {allResults.length > 0 && (() => {
        // Use server-side match_score — sort descending, show >= 40
        const eligible = [...allResults]
          .filter(r => r.match_score >= 40)
          .sort((a, b) => b.match_score - a.match_score);

        const top5 = eligible.slice(0, 5);
        const rest  = eligible.slice(5);

        const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

        const ScoreBar = ({ score }: { score: number }) => {
          const color = score >= 75 ? 'bg-green-500' : score >= 55 ? 'bg-blue-500' : 'bg-amber-400';
          return (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-600 w-8 text-right">{score}%</span>
            </div>
          );
        };

        const SchemeCard = ({ r, rank }: { r: AllResult; rank?: number }) => {
          const link = r.official_link
            ? (r.official_link.startsWith('http') ? r.official_link : `https://${r.official_link.replace(/^\/+/, '')}`)
            : null;
          let docs: string[] = [];
          if (r.documents_required) {
            try { docs = JSON.parse(r.documents_required); } catch { docs = []; }
          }
          return (
            <div className={`bg-white rounded-lg border px-4 py-3 hover:shadow-sm transition-shadow ${rank !== undefined ? 'border-amber-200' : 'border-green-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {rank !== undefined && (
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">{rankEmojis[rank]}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{r.program_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.category}
                      {r.state && r.state !== 'All India' ? ` · ${r.state}` : ''}
                      {r.ministry ? ` · ${r.ministry}` : ''}
                    </p>
                    <ScoreBar score={r.match_score} />
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Apply Online →
                      </a>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex-shrink-0">
                  <CheckCircle className="w-3 h-3" /> Eligible
                </span>
              </div>
              {docs.length > 0 && (
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
              )}
            </div>
          );
        };

        if (eligible.length === 0) {
          return (
            <div className="mt-6 text-center py-12 bg-white rounded-xl border border-gray-200">
              <XCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No eligible schemes found</p>
              <p className="text-sm text-gray-400 mt-1">Try updating your profile details or checking with different inputs.</p>
            </div>
          );
        }

        return (
          <div className="mt-6 space-y-6">
            {/* Top 5 Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-800">Top 5 High-Impact Schemes For You</span>
                </div>
              </div>
              <div className="space-y-3">
                {top5.map((r, i) => (
                  <SchemeCard key={r.program_id} r={r} rank={i} />
                ))}
              </div>
            </div>

            {/* View All toggle */}
            {rest.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <List className="w-4 h-4" />
                  {showAll
                    ? 'Hide remaining schemes'
                    : `View all ${eligible.length} matched schemes (${rest.length} more)`}
                  {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAll && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">All eligible schemes</p>
                    {rest.map(r => (
                      <SchemeCard key={r.program_id} r={r} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary line */}
            <p className="text-xs text-gray-400 text-center">
              {eligible.length} scheme{eligible.length !== 1 ? 's' : ''} matched · sorted by match score · showing top 5
            </p>
          </div>
        );
      })()}
    </div>
  );
}
