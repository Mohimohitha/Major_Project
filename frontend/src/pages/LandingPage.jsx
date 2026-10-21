import { Link } from 'react-router-dom';
import { FileText, Dna, Pill, ShieldCheck, Lock, Database } from 'lucide-react';
import { TypeAnimation } from 'react-type-animation';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 relative">
      
      {/* 1. Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-5 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center text-white font-bold">
            LP
          </div>
          <span className="text-xl font-bold tracking-tight">LabParse <span className="text-gray-500 font-normal">AI</span></span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-gray-600">
          <a href="#platform" className="hover:text-amber-500 transition-colors">Platform</a>
          <a href="#architecture" className="hover:text-amber-500 transition-colors">Architecture</a>
          <a href="#security" className="hover:text-amber-500 transition-colors">Security</a>
          <a href="#demo" className="hover:text-amber-500 transition-colors">Live Demo</a>
        </div>
        <div className="flex items-center space-x-6">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-amber-500">Sign In</Link>
          <Link to="/register" className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* 2. Hero Section (Inherits bg-gray-50) */}
      <section id="platform" className="text-center px-4 pt-36 pb-16">
        <div className="inline-block bg-white border border-gray-200 rounded-full px-4 py-1 mb-8 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            <span className="text-amber-500 mr-2">●</span> Clinical Intelligence Platform • MERN & FastAPI
          </span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 h-32 md:h-20">
          Intelligent <span className="text-amber-500">
            <TypeAnimation
              sequence={[
                'Clinical Data Extraction',
                2500,
                'Diet & Drug Recommendation',
                2500,
                'Biomarker Analysis',
                2500
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
            />
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-lg text-gray-600 mb-10 leading-relaxed">
          A Personalized Predictive Health Care System. Bridge raw laboratory biomarkers with real-time dietary and pharmacological intelligence. Automated interpretation calibrated for modern care.
        </p>
        
        <div className="flex justify-center space-x-4 mb-16">
          <Link to="/login" className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-md font-semibold flex items-center transition-colors shadow-lg shadow-amber-500/30">
            Analyze Clinical Report <span className="ml-2">→</span>
          </Link>
          <a href="#demo" className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-8 py-3 rounded-md font-semibold flex items-center transition-colors shadow-sm">
            <span className="text-amber-500 mr-2">⊙</span> Test Live Demo
          </a>
        </div>

        <div className="flex justify-center space-x-8 text-sm text-gray-500 border-t border-gray-200 pt-8 max-w-3xl mx-auto">
          <div className="flex items-center"><span className="text-amber-500 mr-2">●</span> <strong className="text-gray-900 mr-1">98.5%</strong> Extraction Accuracy</div>
          <div className="flex items-center"><span className="text-amber-500 mr-2">●</span> <strong className="text-gray-900 mr-1">50+</strong> Serum Biomarkers</div>
          <div className="flex items-center"><span className="text-amber-500 mr-2">●</span> <strong className="text-gray-900 mr-1">&lt;2.8s</strong> Inference Latency</div>
        </div>
      </section>

      {/* 3. Architecture Pillars Section (Alternates to bg-white) */}
      <section id="architecture" className="bg-white py-24 border-t border-gray-100 scroll-mt-20">
        <div className="text-center mb-16">
          <h3 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-3">Architecture Pillars</h3>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">The Three Clinical Synthesis Pillars</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Harmonizing unstructured diagnostic exports into deterministic, actionable medical directives.</p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-6">
          <div className="bg-white border border-gray-100 p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-6">
              <FileText size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Smart OCR & Document Slicing</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Direct parsing of hematology and biochemistry panels using robust computer vision. Extracts critical values while bypassing unstructured visual noise.
            </p>
          </div>

          <div className="bg-white border border-gray-100 p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-6">
              <Dna size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">NLP Biomarker Interpretation</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Utilizes fine-tuned natural language processing to map raw text strings to standardized clinical reference ranges, flagging critical anomalies instantly.
            </p>
          </div>

          <div className="bg-white border border-gray-100 p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-6">
              <Pill size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Diet & Drug Synthesis</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Generates tailored metabolic synchronization protocols and pharmacological suggestions derived directly from the patient's extracted deficiency profile.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Security & Compliance Section (Alternates to bg-gray-50) */}
      <section id="security" className="py-24 px-6 bg-gray-50 border-t border-gray-100 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-3">Data Governance</h3>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Enterprise-Grade Security</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Built from the ground up to protect sensitive patient telemetry and clinical history.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mb-6 text-amber-500">
                <ShieldCheck size={32} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">HIPAA BAA Architecture</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Backend routing designed to support Business Associate Agreements. Medical reports are processed securely and deleted from working memory post-extraction.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mb-6 text-amber-500">
                <Lock size={32} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">AES-256 Encryption</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                All saved historical analysis and user credentials are encrypted at rest in our MongoDB instances and securely transmitted over TLS.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mb-6 text-amber-500">
                <Database size={32} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Authenticated Sessions</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Zero public endpoints. Clinical evaluation tools are strictly gated behind verified user authentication to ensure complete data sovereignty.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Live Demo Section (Alternates to bg-white) */}
      <section id="demo" className="py-20 px-6 bg-white border-t border-gray-100 scroll-mt-20">
        <div className="max-w-5xl mx-auto bg-gray-50 border border-gray-100 rounded-2xl p-12 shadow-sm flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-2/3 mb-8 md:mb-0 pr-8">
            <div className="inline-block bg-white border border-gray-200 rounded-full px-3 py-1 mb-6 shadow-sm">
              <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                <span className="text-amber-500 mr-2">●</span> System Evaluation & Live Demo
              </span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Ready to evaluate the LabParse AI inference engine?</h2>
            <p className="text-gray-600 mb-6">Create a free account to upload a sample hematology or biochemistry report. Test the OCR accuracy and NLP pipeline in real-time. Designed to demonstrate end-to-end processing from React frontend to FastAPI backend.</p>
            <div className="flex space-x-6 text-sm text-gray-600 font-medium">
              <span className="flex items-center"><span className="text-amber-500 mr-2">✓</span> Full MERN Stack</span>
              <span className="flex items-center"><span className="text-amber-500 mr-2">✓</span> FastAPI Integration</span>
            </div>
          </div>
          <div className="md:w-1/3 flex flex-col space-y-4">
            <Link to="/login" className="flex justify-center items-center w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-md font-bold shadow-lg shadow-amber-500/30 transition-colors">
              <Lock size={18} className="mr-2" /> Upload Sample Report
            </Link>
            <button className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-4 rounded-md font-bold transition-colors">
              View Architecture Docs
            </button>
          </div>
        </div>
      </section>

      {/* 6. Footer (Alternates to bg-gray-50) */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12 px-10">
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

export default LandingPage;