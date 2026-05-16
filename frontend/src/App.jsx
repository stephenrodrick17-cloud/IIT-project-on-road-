import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AlertCircle, LayoutDashboard, Camera, FileText, Users, Map as MapIcon, Database, Menu, X, Activity, Zap } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Dashboard from './pages/Dashboard';
import DetectionPage from './pages/DetectionPage';
import ContractorsPage from './pages/ContractorsPage';
import MapPage from './pages/MapPage';
import ReportsPage from './pages/ReportsPage';
import DatasetsPage from './pages/DatasetsPage';
import HomePage from './pages/HomePage';
import RoadSOS from './pages/RoadSOS';
import ServicesPage from './pages/ServicesPage';
import AIChatWidget from './components/AIChatWidget';
import ErrorBoundary from './components/ErrorBoundary';
import { AIChatProvider, useAIChat } from './components/AIChatContext';

import './App.css';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [apiHealth, setApiHealth] = useState('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) setApiHealth('online');
        else setApiHealth('offline');
      } catch (error) {
        setApiHealth('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AIChatProvider>
      <ErrorBoundary>
        <Router>
          <div className="min-h-screen text-slate-200 selection:bg-orange-500/30 selection:text-orange-200 bg-transparent">
            {/* Conditional Background Overlay */}
            <BackgroundOverlay />
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-slate-950/60 backdrop-blur-xl border-b border-slate-800 shadow-2xl">
          <div className="w-full px-4 sm:px-6 lg:px-12">
            <div className="flex justify-between h-20">
              <div className="flex items-center">
                <Link to="/" className="flex items-center group">
                  <div className="bg-orange-500 p-2 rounded-xl group-hover:rotate-12 transition-transform duration-300">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-3">
                    <span className="text-xl font-bold text-white block leading-tight tracking-tight">RoadGuard</span>
                    <span className="text-xs uppercase tracking-[0.3em] text-orange-500 font-black">Command Center</span>
                  </div>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center space-x-1">
                <NavLink to="/" label="Home" />
                <NavLink to="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
                <NavLink to="/detect" icon={<Camera size={18} />} label="AI Detection" />
                <NavLink to="/reports" icon={<FileText size={18} />} label="Reports" />
                <NavLink to="/contractors" icon={<Users size={18} />} label="Contractors" />
                <NavLink to="/map" icon={<MapIcon size={18} />} label="Damage Map" />
                <NavLink to="/services" icon={<Zap size={18} />} label="Services" />
                <NavLink to="/datasets" icon={<Database size={18} />} label="Datasets" />
                <NavLink to="/sos" icon={<AlertCircle size={18} />} label="Road SOS" isEmergency />
                
                {/* API Status */}
                <div className="ml-6 flex items-center space-x-3 px-5 py-2.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 transition-all hover:bg-slate-800">
                  <div className={`relative flex h-2 w-2`}>
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${apiHealth === 'online' ? 'bg-emerald-400' : apiHealth === 'offline' ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${apiHealth === 'online' ? 'bg-emerald-500' : apiHealth === 'offline' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                    {apiHealth === 'online' ? 'System Live' : apiHealth === 'offline' ? 'System Offline' : 'Connecting...'}
                  </span>
                </div>
              </div>

              {/* Mobile menu button */}
              <div className="lg:hidden flex items-center">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                >
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-96 border-t border-slate-800 bg-slate-900' : 'max-h-0'}`}>
            <div className="px-4 py-6 space-y-2">
              <MobileNavLink to="/" label="Home" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/detect" icon={<Camera size={20} />} label="AI Detection" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/reports" icon={<FileText size={20} />} label="Reports" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/contractors" icon={<Users size={20} />} label="Contractors" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/map" icon={<MapIcon size={20} />} label="Damage Map" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/services" icon={<Zap size={20} />} label="Services" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/datasets" icon={<Database size={20} />} label="Datasets" onClick={() => setIsMenuOpen(false)} />
              <MobileNavLink to="/sos" icon={<AlertCircle size={20} />} label="Road SOS" isEmergency onClick={() => setIsMenuOpen(false)} />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="w-full px-4 sm:px-6 lg:px-12 py-12">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/detect" element={<DetectionPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/sos" element={<RoadSOS />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-slate-950/40 backdrop-blur-xl border-t border-slate-800 mt-20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center mb-6">
                  <AlertCircle className="w-8 h-8 text-orange-500" />
                  <span className="ml-3 text-2xl font-bold text-white tracking-tight">RoadGuard</span>
                </div>
                <p className="text-slate-400 max-w-sm leading-relaxed">
                  Advanced infrastructure health monitoring platform leveraging computer vision and AI to detect, analyze, and manage urban damage in real-time.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Platform</h3>
                <ul className="text-slate-400 space-y-4">
                  <li><Link to="/detect" className="hover:text-orange-500 transition-colors">AI Analysis</Link></li>
                  <li><Link to="/map" className="hover:text-orange-500 transition-colors">Damage Map</Link></li>
                  <li><Link to="/contractors" className="hover:text-orange-500 transition-colors">Contractors</Link></li>
                  <li><Link to="/sos" className="hover:text-rose-500 transition-colors text-rose-500 font-bold">Emergency SOS</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Support</h3>
                <p className="text-slate-400 mb-2">Technical Assistance</p>
                <a href="mailto:support@roadguard.ai" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
                  support@roadguard.ai
                </a>
              </div>
            </div>
            <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-slate-500 text-sm italic">&copy; 2024 RoadGuard AI Systems. Pioneering Urban Safety.</p>
              <div className="flex items-center space-x-6">
                <span className="text-slate-500 text-xs uppercase tracking-widest">v1.0.0 Stable</span>
                <div className="flex items-center space-x-2 text-slate-400">
                  <Activity size={14} className="text-emerald-500" />
                  <span className="text-xs font-semibold">ALL SYSTEMS NOMINAL</span>
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* Toast Notifications */}
        <ToastContainer 
          position="bottom-right" 
          autoClose={4000}
          theme="dark"
          toastClassName="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl"
        />

        {/* Global AI Chat Widget */}
        <GlobalAIChat />
      </div>
        </Router>
      </ErrorBoundary>
    </AIChatProvider>
  );
}

// GlobalAIChat reads context set by DetectionPage
function GlobalAIChat() {
  const { analysisContext } = useAIChat();
  return <AIChatWidget analysisContext={analysisContext} />;
}

function NavLink({ to, icon, label, isEmergency }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
        isActive 
          ? isEmergency ? 'bg-rose-500/10 text-rose-500 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.2)]' : 'bg-orange-500/10 text-orange-500 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.2)]'
          : isEmergency ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MobileNavLink({ to, icon, label, onClick, isEmergency }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-bold transition-all ${
        isActive 
          ? isEmergency ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
          : isEmergency ? 'text-rose-400 bg-rose-500/5 hover:bg-rose-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function BackgroundOverlay() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  if (isHomePage) return null;
  
  return <div className="pothole-bg-overlay animate-in fade-in duration-1000" />;
}

export default App;
