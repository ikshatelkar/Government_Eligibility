import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../services/api';
import { toast } from 'sonner';
import { Loader2, Save, ChevronDown } from 'lucide-react';

export default function ProfilePage() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    date_of_birth: '',
    aadhaar_number: '',
    address: '',
    state: '',
    district: '',
    city: '',
    pincode: '',
    annual_income: '',
    employment_status: 'unemployed',
    occupation: 'other',
    has_disability: false,
    is_citizen: true,
    gender: 'male',
    caste: 'General',
  });

  useEffect(() => {
    profileApi.get(token!)
      .then(data => {
        const p = data.profile;
        setForm({
          full_name: p.full_name || '',
          phone: p.phone || '',
          date_of_birth: p.date_of_birth ? p.date_of_birth.split('T')[0] : '',
          aadhaar_number: p.aadhaar_number || '',
          address: p.address || '',
          state: p.state || '',
          district: p.district || '',
          city: p.city || '',
          pincode: p.pincode || '',
          annual_income: p.annual_income || '',
          employment_status: p.employment_status || 'unemployed',
          occupation: p.occupation || 'other',
          has_disability: !!p.has_disability,
          is_citizen: p.is_citizen !== false,
          gender: p.gender || 'male',
          caste: p.caste || 'General',
        });
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await profileApi.update(form, token!);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Profile</h1>
      <p className="text-gray-500 text-sm mb-6">Keep your profile up-to-date for accurate eligibility results</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Phone Number">
              <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" className={inputClass} />
            </Field>
            <Field label="Date of Birth">
              <input type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Aadhaar Number">
              <input type="text" value={form.aadhaar_number} onChange={e => setForm(p => ({ ...p, aadhaar_number: e.target.value }))} placeholder="XXXX XXXX XXXX" className={inputClass} />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Email Address">
              <input type="email" value={user?.email || ''} disabled className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`} />
            </Field>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Address</h2>
          <div className="space-y-4">
            <Field label="Street Address">
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="City / Town">
                <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="District">
                <input type="text" value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="State">
                <div className="relative">
                  <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={`${inputClass} appearance-none bg-white`}>
                    <option value="">Select State</option>
                    {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </Field>
              <Field label="PIN Code">
                <input type="text" value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} placeholder="6-digit PIN" className={inputClass} />
              </Field>
            </div>
          </div>
        </div>

        {/* Socioeconomic */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Socioeconomic Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Annual Income (₹)">
              <input type="number" min="0" value={form.annual_income} onChange={e => setForm(p => ({ ...p, annual_income: e.target.value }))} placeholder="e.g. 250000" className={inputClass} />
            </Field>
            <Field label="Employment Status">
              <div className="relative">
                <select value={form.employment_status} onChange={e => setForm(p => ({ ...p, employment_status: e.target.value }))} className={`${inputClass} appearance-none bg-white`}>
                  <option value="employed">Employed</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="self_employed">Self-Employed</option>
                  <option value="retired">Retired</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field label="Occupation">
              <div className="relative">
                <select value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))} className={`${inputClass} appearance-none bg-white`}>
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
            </Field>
            <Field label="Gender">
              <div className="relative">
                <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} className={`${inputClass} appearance-none bg-white`}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field label="Category / Caste">
              <div className="relative">
                <select value={form.caste} onChange={e => setForm(p => ({ ...p, caste: e.target.value }))} className={`${inputClass} appearance-none bg-white`}>
                  <option value="General">General</option>
                  <option value="OBC">OBC (Other Backward Class)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </Field>
          </div>
          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.has_disability} onChange={e => setForm(p => ({ ...p, has_disability: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Person with Disability (Divyangjan)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_citizen} onChange={e => setForm(p => ({ ...p, is_citizen: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Indian Citizen</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
