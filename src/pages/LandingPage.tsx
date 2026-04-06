import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Users, FileText, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 lg:px-16 py-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-xl backdrop-blur">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">GovCheck</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-4 py-2 text-sm font-medium bg-white text-blue-900 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="px-6 lg:px-16 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-700/50 text-blue-200 text-xs font-medium px-3 py-1.5 rounded-full mb-6 backdrop-blur border border-blue-600/50">
          <span className="w-1.5 h-1.5 bg-blue-300 rounded-full"></span>
          Powered by AI &amp; Machine Learning
        </div>
        <h1 className="text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-6 max-w-4xl mx-auto">
          Check Your Government
          <span className="text-blue-300"> Benefit Eligibility</span>
          <br />Instantly
        </h1>
        <p className="text-lg text-blue-200 max-w-2xl mx-auto mb-10">
          Our AI-powered system instantly evaluates your eligibility for government programs,
          benefits, and assistance — saving you time and paperwork.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/register')}
            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-blue-900 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-black/20"
          >
            Check Eligibility Now
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3.5 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors backdrop-blur"
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white/5 backdrop-blur border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 lg:px-16 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: CheckCircle,
              title: 'Instant AI Results',
              desc: 'Our ML model analyzes your profile against all active programs in seconds.',
            },
            {
              icon: FileText,
              title: 'Track Applications',
              desc: 'Submit and monitor your benefit applications all in one place.',
            },
            {
              icon: Users,
              title: 'Multiple Programs',
              desc: 'Check eligibility across housing, welfare, education, disability, and more.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600/30 rounded-xl mx-auto mb-4 border border-blue-500/30">
                <Icon className="w-6 h-6 text-blue-300" />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-blue-300 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-blue-400 text-sm border-t border-white/10">
        © 2026 Government Eligibility Checker System. All rights reserved.
      </div>
    </div>
  );
}
