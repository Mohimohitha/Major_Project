import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Activity, ShieldCheck, ArrowLeft, Calendar, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    sex: '',
    dob: '',
    password: '',
    confirmPassword: '',
    agreed: false
  });

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing again
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Front-end validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Point this to your Node.js backend port (adjust 5000 if needed)
      await axios.post('http://localhost:5000/api/auth/register', {
        fullName: formData.fullName,
        email: formData.email,
        sex: formData.sex,
        dob: formData.dob,
        password: formData.password,
        agreed: formData.agreed
      });
      
      // On success, redirect to login page
      navigate('/login');
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 relative">
      
      {/* LEFT SIDE - LIGHT BLUE THEME WITH AMBER ACCENTS (STRICTLY FIXED) */}
      <div className="hidden lg:flex flex-col justify-between fixed top-0 left-0 w-1/2 h-screen bg-blue-50/60 border-r border-blue-100 p-12">
        
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
            <span className="text-xs font-bold tracking-wider text-amber-700 uppercase">Clinical Engine V4.2</span>
          </div>
          
          <h1 className="text-4xl font-extrabold mb-6 leading-tight text-gray-900 tracking-tight">
            Empowering patients with immediate biomarker calibration.
          </h1>
          
          <p className="text-gray-600 text-lg leading-relaxed">
            Establish your encrypted profile to calibrate predictive biomarkers and personal lab reference boundaries.
          </p>
        </div>
        
        <div className="flex space-x-6 text-xs text-amber-700/60 font-mono font-semibold tracking-wider">
          <span>SYS-ANALYZER READY</span>
          <span>•</span>
          <span>HIPAA BAA COMPLIANT</span>
        </div>
      </div>

      {/* RIGHT SIDE - SCROLLABLE FORM */}
      <div className="w-full lg:w-1/2 lg:ml-[50%] min-h-screen flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md">
          
          <Link to="/" className="flex lg:hidden items-center space-x-2 mb-10 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={20} className="mr-2" />
            <span className="font-bold tracking-tight">Back to LabParse</span>
          </Link>

          <div className="mb-10">
            <div className="inline-block bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Intake Portal • Patient Registration
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Create Your Account</h2>
            <p className="text-gray-500 text-sm">Secure intake portal for personalized diagnostic telemetry.</p>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start text-sm">
              <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Full Legal Name <span className="text-red-500">*</span>
              </label>
              <div className="relative h-[46px]">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input 
                  type="text" name="fullName" required
                  placeholder="e.g. Sarah Jenkins"
                  onChange={handleChange}
                  className="w-full h-full pl-4 pr-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Secure Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative h-[46px]">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" name="email" required
                  placeholder="sarah@example.com"
                  onChange={handleChange}
                  className="w-full h-full pl-4 pr-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Grid for Sex and DOB */}
            <div className="flex space-x-4">
              
              {/* Biological Sex */}
              <div className="w-1/2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Biological Sex at Birth <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2 h-[46px]">
                  <label className={`flex-1 border rounded-lg cursor-pointer transition-all flex flex-col items-center justify-center ${formData.sex === 'Male' ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-gray-300 hover:border-amber-400'}`}>
                    <input type="radio" name="sex" value="Male" required onChange={handleChange} className="hidden" />
                    <div className="font-bold text-sm text-gray-900">M</div>
                  </label>
                  <label className={`flex-1 border rounded-lg cursor-pointer transition-all flex flex-col items-center justify-center ${formData.sex === 'Female' ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-gray-300 hover:border-amber-400'}`}>
                    <input type="radio" name="sex" value="Female" required onChange={handleChange} className="hidden" />
                    <div className="font-bold text-sm text-gray-900">F</div>
                  </label>
                </div>
              </div>

              {/* Date of Birth */}
              <div className="w-1/2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="relative h-[46px]">
                  <input 
                    type="date" name="dob" required
                    onChange={handleChange}
                    className="w-full h-full pl-4 pr-10 bg-white border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                    <Calendar size={18} />
                  </div>
                </div>
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative h-[46px]">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" required minLength="8"
                    placeholder="Min 8 chars"
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
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Confirm <span className="text-red-500">*</span>
                </label>
                <div className="relative h-[46px]">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    name="confirmPassword" required
                    placeholder="Confirm"
                    onChange={handleChange}
                    className="w-full h-full pl-4 pr-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Policy Checkbox */}
            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 mt-6 flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                <input 
                  type="checkbox" name="agreed" required id="policy"
                  onChange={handleChange}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                />
              </div>
              <label htmlFor="policy" className="text-xs text-gray-600 cursor-pointer leading-relaxed">
                I legally consent to LabParse AI processing my health metrics and diagnostic data in strict accordance with <strong className="text-gray-900">HIPAA Security Rules</strong>. <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className={`w-full font-bold py-4 rounded-lg shadow-lg transition-colors mt-6 flex items-center justify-center ${
                isLoading 
                  ? 'bg-amber-400 cursor-not-allowed text-amber-50 shadow-none' 
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30'
              }`}
            >
              {isLoading ? 'Processing Registration...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-amber-600 hover:text-amber-700 transition-colors">
                Sign in here →
              </Link>
            </p>
          </div>

          <div className="flex items-center justify-center text-xs text-gray-400 mt-8 space-x-2">
            <ShieldCheck size={14} />
            <span>Encrypted Telemetry • AES-256</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Register;