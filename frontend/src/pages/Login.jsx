import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Activity, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login Data:', formData);
    // Future: Authenticate with FastAPI backend
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 relative">
      
      {/* LEFT SIDE - MATCHING LIGHT AMBER / CLINICAL THEME (STRICTLY FIXED) */}
      <div className="hidden lg:flex flex-col justify-between fixed top-0 left-0 w-1/2 h-screen bg-amber-50/60 border-r border-amber-100 p-12">
        
        <div>
          <Link to="/" className="inline-flex items-center text-amber-600 hover:text-amber-700 transition-colors text-sm font-semibold">
            <ArrowLeft size={18} className="mr-2" />
            Back to Platform
          </Link>
        </div>

        <div className="max-w-md my-auto">
          <div className="flex items-center space-x-2 mb-8">
            <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center text-white font-bold shadow-sm">
              LP
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">LabParse <span className="text-gray-500 font-normal">AI</span></span>
          </div>

          <div className="inline-flex items-center bg-white border border-amber-200 rounded-full px-3 py-1 mb-6 shadow-sm">
            <Activity size={14} className="text-amber-500 mr-2" />
            <span className="text-xs font-bold tracking-wider text-amber-700 uppercase">Engine V4.2 Active</span>
          </div>
          
          <h1 className="text-4xl font-extrabold mb-6 leading-tight text-gray-900 tracking-tight">
            Empowering patients with real-time verification and clarity.
          </h1>
          
          <p className="text-gray-600 text-lg leading-relaxed">
            Access certified lab telemetry, pharmacological interaction flags, and therapeutic monitoring.
          </p>
        </div>
        
        <div className="flex space-x-6 text-xs text-amber-700/60 font-mono font-semibold tracking-wider">
          <span>HIPAA LEVEL-4 COMPLIANT</span>
          <span>•</span>
          <span>256-BIT TLS</span>
        </div>
      </div>

      {/* RIGHT SIDE - SCROLLABLE LOGIN FORM */}
      <div className="w-full lg:w-1/2 lg:ml-[50%] min-h-screen flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md">
          
          {/* Mobile Back Link */}
          <Link to="/" className="flex lg:hidden items-center space-x-2 mb-10 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={20} className="mr-2" />
            <span className="font-bold tracking-tight">Back to LabParse</span>
          </Link>

          <div className="mb-10">
            <div className="inline-block bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Clinical Auth Gateway
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Sign In to Your Account</h2>
            <p className="text-gray-500 text-sm">Access certified lab telemetry and therapeutic monitoring.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email / Medical ID */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative h-[46px]">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" name="email" required
                  placeholder="patient@labparse.org"
                  onChange={handleChange}
                  className="w-full h-full pl-4 pr-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Password <span className="text-red-500">*</span>
                </label>
                <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                  Forgot password?
                </a>
              </div>
              <div className="relative h-[46px]">
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password" required 
                  placeholder="••••••••••••"
                  onChange={handleChange}
                  className="w-full h-full pl-4 pr-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Terminal Checkbox */}
            <div className="flex items-center space-x-3">
              <input 
                type="checkbox" name="rememberMe" id="remember"
                onChange={handleChange}
                className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-gray-600 cursor-pointer">
                Remember this diagnostic terminal for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-lg shadow-lg shadow-amber-500/30 transition-colors mt-4"
            >
              Sign In to Workstation →
            </button>
          </form>

          {/* Register Link */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              New to LabParse?{' '}
              <Link to="/register" className="font-bold text-amber-600 hover:text-amber-700 transition-colors">
                Create an account / Register here
              </Link>
            </p>
          </div>

          <div className="flex items-center justify-center text-xs text-gray-400 mt-8 space-x-2">
            <ShieldCheck size={14} />
            <span>Audit trails are logged permanently.</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;