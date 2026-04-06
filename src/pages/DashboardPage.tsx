import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FileText, BookOpen, BarChart2, ArrowRight, Shield } from 'lucide-react';

const actions = [
  {
    to: '/check',
    icon: CheckSquare,
    label: 'Check Eligibility',
    desc: 'Find out which programs you qualify for',
    color: 'bg-blue-500',
  },
  {
    to: '/programs',
    icon: BookOpen,
    label: 'Browse Programs',
    desc: 'Explore all available government programs',
    color: 'bg-indigo-500',
  },
  {
    to: '/applications',
    icon: FileText,
    label: 'My Applications',
    desc: 'Track your submitted benefit applications',
    color: 'bg-violet-500',
  },
  {
    to: '/results',
    icon: BarChart2,
    label: 'My Results',
    desc: 'View your past eligibility check results',
    color: 'bg-purple-500',
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 lg:p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-10">
          <Shield className="w-32 h-32" />
        </div>
        <p className="text-blue-200 text-sm mb-1">Welcome back,</p>
        <h1 className="text-2xl lg:text-3xl font-bold mb-2">{user?.full_name}</h1>
        <p className="text-blue-200 text-sm">
          Check your eligibility for government programs and manage your applications.
        </p>
        <button
          onClick={() => navigate('/check')}
          className="mt-5 inline-flex items-center gap-2 bg-white text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Check Eligibility
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Action cards */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map(({ to, icon: Icon, label, desc, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="bg-white rounded-xl p-5 text-left hover:shadow-md transition-all border border-gray-200 hover:border-blue-200 group"
          >
            <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center mb-4`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-blue-700 transition-colors">{label}</h3>
            <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <div className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5">⚠️</div>
        <div>
          <p className="text-sm font-medium text-amber-800">Complete your profile for accurate results</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Add your age, income, and employment status in your profile to get the most accurate eligibility checks.{' '}
            <button onClick={() => navigate('/profile')} className="underline font-medium">Update now →</button>
          </p>
        </div>
      </div>
    </div>
  );
}
