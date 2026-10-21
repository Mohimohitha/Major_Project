import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  UploadCloud, FileText, Bell, User, Home, 
  FileCheck, RefreshCw, Sparkles, AlertTriangle, 
  CheckCircle2, XCircle, Pill, Utensils, LogOut, ShieldCheck 
} from 'lucide-react';

const Dashboard = () => {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file) return;

    setAnalyzing(true);

    // Simulate backend AI telemetry extraction delay
    setTimeout(() => {
      setAnalysisResult({
        reportId: `LAB-${Math.floor(1000 + Math.random() * 9000)}-CBC`,
        biomarker: 'Hemoglobin',
        value: '9.0 g/dL',
        status: 'CRITICAL LOW',
        referenceRange: '12.0 - 15.5 g/dL (Adult Female) / 13.5 - 17.5 g/dL (Adult Male)',
        confidence: '99.4%',
        diagnosis: 'Moderate Anemia',
        explanation: 'Your red blood cell count is significantly lower than normal. This means your blood is struggling to carry enough oxygen to your organs, which is likely causing fatigue, dizziness, or shortness of breath.',
        percentage: 45,
        target: '13.5+ g/dL',
        drugs: [
          'Oral Iron Supplements (e.g., Ferrous Sulfate)',
          'Folic Acid / Vitamin B12'
        ],
        smartTip: 'Take iron supplements on an empty stomach with a glass of orange juice, as Vitamin C increases iron absorption by up to 30%.',
        diet: {
          good: [
            { title: 'Heme Iron', desc: 'Lean red meats, poultry, liver, and fish.' },
            { title: 'Non-Heme Iron', desc: 'Spinach, kale, lentils, chickpeas, and fortified cereals.' },
            { title: 'Vitamin C Boosters', desc: 'Oranges, strawberries, bell peppers, and tomatoes.' }
          ],
          blockers: [
            { title: 'Tannins & Polyphenols', desc: 'Black tea, green tea, and coffee. (Avoid within 2 hours of iron intake).' },
            { title: 'Calcium Overload', desc: 'Milk, cheese, and yogurt. (Eat dairy as a separate snack).' },
            { title: 'High-Phytate Foods', desc: 'Unsoaked beans and bran.' }
          ]
        }
      });
      setAnalyzing(false);
    }, 1500);
  };

  const handleLogout = () => {
    // Perform any auth state cleanup here if needed
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 flex flex-col justify-between">
      
      <div>
        {/* TOP NAVBAR */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20">
                LP
              </div>
              <span className="text-lg font-extrabold tracking-tight text-gray-900">LabParse <span className="text-amber-600 font-normal">AI</span></span>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-gray-600">
              <Link to="/dashboard" className="flex items-center text-amber-600 hover:text-amber-700 transition-colors">
                <Home size={16} className="mr-2" />
                Home
              </Link>
              <Link to="/dashboard" className="flex items-center hover:text-amber-600 transition-colors">
                <FileCheck size={16} className="mr-2" />
                Analysed Reports
              </Link>
            </nav>

            {/* Active Engine, Notifications, Profile Dropdown */}
            <div className="flex items-center space-x-5 relative">
              <div className="hidden lg:flex items-center bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-700 tracking-wide uppercase">Active Engine</span>
              </div>

              <button className="p-2 text-gray-400 hover:text-amber-600 transition-colors rounded-full hover:bg-gray-100 relative">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full"></span>
              </button>

              <div className="h-6 w-px bg-gray-200"></div>

              {/* Profile Menu Trigger */}
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-3 cursor-pointer focus:outline-none"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-sm border border-amber-200 hover:bg-amber-200 transition-colors">
                    <User size={18} />
                  </div>
                </button>

                {/* Profile Dropdown Box */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-3 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50 text-xs">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-bold text-gray-900">Sarah Jenkins</p>
                      <p className="text-gray-400 font-mono text-[10px]">sarah@example.com</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 flex items-center font-semibold transition-colors"
                    >
                      <LogOut size={14} className="mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
          
          {/* HEADING & SUBHEADING */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-block bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Diagnostic Telemetry Suite
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Clinical Lab Intelligence & Report Analysis
            </h1>
            <p className="text-sm text-gray-500">
              Upload your lab documents for instant multi-agent biomarker extraction, reference boundary calibration, and therapeutic safety checks.
            </p>
          </div>

          {/* UPLOAD SECTION (IMAGE / PDF) */}
          <section className="bg-white border-2 border-dashed border-gray-200 hover:border-amber-400 rounded-2xl p-8 text-center transition-all shadow-sm">
            <form onSubmit={handleAnalyze} className="max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2">
                <UploadCloud size={32} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Upload Clinical Lab Report</h2>
                <p className="text-xs text-gray-500 mt-1">Drag and drop your CBC report (PDF, PNG, JPG) or click to browse.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <label className="cursor-pointer bg-white border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all flex items-center">
                  <FileText size={16} className="mr-2 text-gray-400" />
                  {file ? file.name : 'Select Lab File...'}
                  <input type="file" onChange={handleFileChange} accept=".pdf, .png, .jpg, .jpeg" className="hidden" />
                </label>

                <button 
                  type="submit" 
                  disabled={!file || analyzing}
                  className={`px-6 py-2.5 rounded-lg font-bold text-xs text-white shadow-md transition-all flex items-center ${!file ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}
                >
                  {analyzing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin mr-2" />
                      Analyzing Telemetry...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-2" />
                      Analyze Report
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* LATEST ANALYSIS RESULTS DIVIDER */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3">Latest Analysis Results</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* CONDITIONAL RENDER: EMPTY STATE VS FULL MULTI-SECTION BREAKDOWN */}
          {!analysisResult ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                <FileText size={24} />
              </div>
              <h4 className="text-sm font-bold text-gray-800">Not yet have any analysis report</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Upload a CBC or metabolic panel document using the dropzone above to trigger report analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              
              {/* 1. CLINICAL SNAPSHOT BANNER */}
              <div className="bg-amber-400 rounded-2xl p-6 text-gray-900 shadow-lg shadow-amber-400/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-amber-900/10 px-2.5 py-1 rounded-md text-amber-950 font-mono">Clinical Snapshot</span>
                  <h3 className="text-3xl font-extrabold tracking-tight mt-2">{analysisResult.biomarker} {analysisResult.value}</h3>
                  <p className="text-xs font-medium text-amber-950/80 mt-1">
                    Reference Range: {analysisResult.referenceRange}
                  </p>
                </div>
                <div className="bg-white/90 backdrop-blur-sm text-amber-900 font-bold px-4 py-2 rounded-xl text-xs flex items-center shadow-sm">
                  <AlertTriangle size={16} className="mr-2 text-amber-600" />
                  {analysisResult.status}
                </div>
              </div>

              {/* 2 & 3. SIDE-BY-SIDE GRID: ANALYZED TEXT + DRUG RECOMMENDATIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Side: Analyzed Text & Biomarker Extraction Section */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-500">Extracted Value: {analysisResult.biomarker} {analysisResult.value}</h4>
                    <span className="text-[10px] text-gray-400 font-mono">Confidence: {analysisResult.confidence}</span>
                  </div>

                  <div className="inline-flex items-center bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                    AI Diagnosis: {analysisResult.diagnosis}
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">
                    {analysisResult.explanation}
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span className="text-amber-600 font-bold">Low ({analysisResult.value})</span>
                      <span>Target: {analysisResult.target}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                      <div className="bg-amber-500 h-full rounded-full transition-all duration-1000" style={{ width: `${analysisResult.percentage}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Drug Recommendations & AI Smart Tip Section */}
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Disclaimer: Consult a doctor before starting medication</p>
                    <div className="space-y-3">
                      {analysisResult.drugs.map((drug, idx) => (
                        <div key={idx} className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800">
                          <Pill size={16} className="text-amber-600 mr-3 flex-shrink-0" />
                          {drug}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Smart Tip */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 space-y-2 shadow-sm">
                    <div className="flex items-center text-amber-800 font-bold text-xs uppercase tracking-wide">
                      <Sparkles size={16} className="mr-2 text-amber-600" />
                      AI Smart Tip
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {analysisResult.smartTip}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. PERSONALIZED DIET RECOMMENDATION SECTION */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
                <div className="flex items-center space-x-3 border-b border-gray-100 pb-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Personalized Meal Plan</h4>
                    <p className="text-xs text-gray-500">Dietary adjustments targeted for biomarker recovery.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>High Iron + Vitamin C</span>
                    </div>
                    <ul className="space-y-3 text-xs text-gray-700">
                      {analysisResult.diet.good.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-emerald-600 font-bold mr-2">✓</span>
                          <span><strong>{item.title}:</strong> {item.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
                      <XCircle size={18} className="text-rose-600" />
                      <span>Iron Blockers</span>
                    </div>
                    <ul className="space-y-3 text-xs text-gray-700">
                      {analysisResult.diet.blockers.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-rose-600 font-bold mr-2">✗</span>
                          <span><strong>{item.title}:</strong> {item.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* FOOTER METADATA */}
              <div className="text-center text-xs text-gray-400 font-mono py-4 border-t border-gray-100 flex flex-wrap justify-center gap-4">
                <span>Report ID: {analysisResult.reportId}</span>
                <span>•</span>
                <span>Extracted via Clinical Laboratory AI Model</span>
                <span>•</span>
                <span>For clinical decision support only</span>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* 6. LANDING-STYLE MULTI-COLUMN FOOTER */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12 px-10 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center text-white text-xs font-bold">LP</div>
              <span className="text-lg font-bold text-gray-900">LabParse AI</span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              Clinical intelligence architecture and diagnostic telemetry for precision healthcare systems.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4 text-sm tracking-wider">DIAGNOSTIC ENGINE</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-amber-500">Lab Simplifier</a></li>
              <li><a href="#" className="hover:text-amber-500">Drug Matrix</a></li>
              <li><a href="#" className="hover:text-amber-500">Dietary Protocols</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4 text-sm tracking-wider">COMPLIANCE & TRUST</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#security" className="hover:text-amber-500">HIPAA Certified</a></li>
              <li><a href="#security" className="hover:text-amber-500">SOC2 Type II</a></li>
              <li><a href="#security" className="hover:text-amber-500">Audit Logs</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4 text-sm tracking-wider">GOVERNANCE</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-amber-500">Clinical Review Board</a></li>
              <li><a href="#" className="hover:text-amber-500">Terms of Practice</a></li>
              <li><a href="#" className="hover:text-amber-500">Data Sovereignty</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between text-xs text-gray-400">
          <p>© 2026 LabParse Clinical AI Inc. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span>Class II Diagnostic Support Framework</span>
            <span>Latency &lt;45ms</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Dashboard;