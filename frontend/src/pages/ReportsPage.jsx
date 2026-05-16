import React, { useEffect, useState } from 'react';
import { Download, Search, Calendar, Zap, AlertCircle, X, MapPin, Activity, Shield, Bot, MessageSquare, TrendingUp, PieChart as PieIcon, Crosshair } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import API from '../services/api';
import { toast } from 'react-toastify';
import AIChatWidget from '../components/AIChatWidget';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showAIExplanation, setShowAIExplanation] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await API.getRecentReports(50);
        setReports(data || []);
      } catch (error) {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
    
    // Real-time polling: Refresh reports data every 30 seconds
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, []);

  const downloadReport = (reportId) => {
    toast.info('Generating Intelligence Export (PDF)...');
  };

  // Mock data for visualizations based on selected report
  const getVisualizationData = (report) => {
    if (!report) return { costData: [], distributionData: [], radarData: [] };
    
    const costData = [
      { name: 'Materials', value: report.estimated_cost || 5000 },
      { name: 'Labor', value: report.labor_cost || 3000 },
      { name: 'Admin', value: (report.total_cost - (report.estimated_cost || 5000) - (report.labor_cost || 3000)) || 1000 }
    ];

    const distributionData = [
      { name: 'Reported', value: 40 },
      { name: 'Resolved', value: 60 }
    ];

    const radarData = [
      { subject: 'Confidence', A: (report.confidence_score || 0.8) * 100, fullMark: 100 },
      { subject: 'Severity', A: report.severity === 'severe' ? 90 : report.severity === 'moderate' ? 60 : 30, fullMark: 100 },
      { subject: 'Cost Impact', A: Math.min(100, (report.total_cost / 100000) * 100), fullMark: 100 },
      { subject: 'Density', A: 70, fullMark: 100 },
      { subject: 'Structural Risk', A: report.severity === 'severe' ? 95 : 50, fullMark: 100 }
    ];

    return { costData, distributionData, radarData };
  };

  const CHART_COLORS = ['#f97316', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];

  // Apply both filter and search term with proper validation
  const filteredReports = reports.filter(r => {
    const matchesFilter = filter === 'all' 
      ? true 
      : (r?.severity === filter || r?.status === filter);
    
    const matchesSearch = !searchTerm 
      ? true 
      : (String(r?.id).includes(searchTerm) || 
         (r?.damage_type ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] space-y-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-slate-400 font-bold uppercase tracking-widest animate-pulse">Syncing Database...</p>
      </div>
    );
  }

  const { costData, distributionData, radarData } = getVisualizationData(selectedReport);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* AI Assistant Context Overlay */}
      {showAIExplanation && selectedReport && (
        <AIChatWidget analysisContext={{
          type: 'historical_report',
          report_id: selectedReport.id,
          detections: [{
            damage_type: selectedReport.damage_type,
            severity: selectedReport.severity,
            confidence: selectedReport.confidence_score,
            cost_estimation: { total_cost: selectedReport.total_cost }
          }],
          summary: {
            total_estimated_cost: selectedReport.total_cost,
            avg_confidence: selectedReport.confidence_score
          }
        }} />
      )}

      {/* Header Context */}
      <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-xl rounded-[3rem] p-12 border border-slate-800 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h1 className="text-6xl font-black text-white tracking-tighter mb-4 leading-none">
              INCIDENT <span className="text-orange-500">REPORTS</span>
            </h1>
            <p className="text-slate-400 text-2xl font-medium leading-relaxed">
              Comprehensive legal-grade database of all detected infrastructure 
              damage and structural anomalies requiring intervention.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex gap-1 shadow-inner">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
              <FilterButton active={filter === 'severe'} onClick={() => setFilter('severe')} label="Severe" color="text-rose-500" />
              <FilterButton active={filter === 'moderate'} onClick={() => setFilter('moderate')} label="Moderate" color="text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden group hover:border-slate-700 transition-all duration-500">
        <div className="p-8 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by ID or damage type..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.slice(0, 100))}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4 text-xs font-black text-slate-500 uppercase tracking-widest">
            <Calendar className="w-4 h-4 text-orange-500" />
            Last 30 Days of Activity
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/30">
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Incident ID</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Classification</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Severity</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Confidence</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Est. Cost</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                <th className="px-8 py-5 text-sm font-black text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredReports.map((report) => (
                <tr 
                  key={report.id} 
                  className="hover:bg-slate-800/30 transition-colors group/row cursor-pointer"
                  onClick={() => setSelectedReport(report)}
                >
                  <td className="px-8 py-6 text-sm font-mono text-slate-400">#{report.id}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-orange-500 group-hover/row:scale-110 transition-transform">
                        <Zap size={14} />
                      </div>
                      <span className="text-white font-bold text-sm capitalize">{report.damage_type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <SeverityBadge severity={report.severity} />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 w-12 bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${(report.confidence_score ?? 0) * 100}%` }}></div>
                      </div>
                      <span className="text-xs font-mono text-slate-400">{((report.confidence_score ?? 0) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-emerald-500 font-black text-sm">₹{(report.total_cost ?? 0).toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-8 py-6">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-8 py-6 text-xs font-medium text-slate-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadReport(report.id); }}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-orange-500 text-slate-400 hover:text-white transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95"
                      title="Export Data"
                    >
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReports.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto border border-slate-700">
                <AlertCircle className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No Matching Records Found</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-6xl bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <button 
              onClick={() => { setSelectedReport(null); setShowAIExplanation(false); }}
              className="absolute top-6 right-6 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all z-10"
            >
              <X size={20} />
            </button>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left: Image & Visuals (7 cols) */}
                <div className="lg:col-span-7 border-r border-slate-800/50">
                  <div className="relative h-[400px] bg-slate-950 overflow-hidden">
                    {selectedReport.image_path ? (
                      <img 
                        src={`/api/detection/report/${selectedReport.id}/image`}
                        alt="Damage" 
                        className="w-full h-full object-cover transition-transform duration-1000 hover:scale-110"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML += '<div class="flex items-center justify-center h-full"><p class="text-slate-500">Image not available</p></div>';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-500">No image available</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                    <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                      <div>
                        <SeverityBadge severity={selectedReport.severity} />
                        <h2 className="text-4xl font-black text-white mt-4 capitalize tracking-tighter">
                          {selectedReport.damage_type.replace('_', ' ')}
                        </h2>
                        <div className="flex items-center gap-2 text-slate-400 mt-2 font-mono text-sm">
                          <MapPin size={14} className="text-orange-500" /> {selectedReport.location_name || 'Satellite Sector 7-G'}
                        </div>
                      </div>
                      <div className="hidden md:block">
                        <button 
                          onClick={() => setShowAIExplanation(true)}
                          className="px-6 py-3 bg-white text-slate-900 font-black rounded-2xl flex items-center gap-2 hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95"
                        >
                          <Bot size={18} /> Ask AI Advisor
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Visual Analysis Grid */}
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900/50">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={12} className="text-orange-500" /> Cost Distribution</p>
                      <div className="h-[200px] bg-slate-950/50 rounded-3xl border border-slate-800 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={costData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                            <YAxis hide />
                            <ChartTooltip 
                              contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                              itemStyle={{ color: '#f97316' }}
                            />
                            <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Crosshair size={12} className="text-orange-500" /> Structural Radar</p>
                      <div className="h-[200px] bg-slate-950/50 rounded-3xl border border-slate-800 p-4 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 8, fontWeight: 'bold' }} />
                            <Radar
                              name="Analysis"
                              dataKey="A"
                              stroke="#f97316"
                              fill="#f97316"
                              fillOpacity={0.6}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Technical Specifications (5 cols) */}
                <div className="lg:col-span-5 p-10 space-y-10">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Technical Specs</p>
                      <span className="text-xs font-mono text-slate-600">ID: {selectedReport.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <DetailBox icon={<Activity size={16} />} label="Confidence" value={`${((selectedReport?.confidence_score ?? 0) * 100).toFixed(1)}%`} />
                      <DetailBox icon={<Shield size={16} />} label="Status" value={(selectedReport?.status ?? 'unknown').replace('_', ' ')} />
                      <DetailBox icon={<MapPin size={16} />} label="Road Type" value={selectedReport?.road_type ?? 'Urban Highway'} />
                      <DetailBox icon={<Calendar size={16} />} label="Timestamp" value={selectedReport?.created_at ? new Date(selectedReport.created_at).toLocaleString() : 'N/A'} />
                    </div>
                  </div>

                  <div className="p-8 bg-slate-950 rounded-[2rem] border border-slate-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={80} className="text-orange-500" />
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6">Economic Recovery Estimation</p>
                    <div className="space-y-4 relative z-10">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-medium">Material (Bitumen/Concrete)</span>
                        <span className="text-white font-bold">₹{(selectedReport?.estimated_cost ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-medium">Labor & Equipment</span>
                        <span className="text-white font-bold">₹{(selectedReport?.labor_cost ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="pt-6 mt-2 border-t border-slate-800 flex justify-between items-end">
                        <div>
                          <span className="text-orange-500 font-black text-[10px] uppercase tracking-widest block mb-1">Total Project Cost</span>
                          <span className="text-emerald-500 font-black text-4xl tracking-tighter">₹{(selectedReport?.total_cost ?? 0).toLocaleString('en-IN')}</span>
                        </div>
                        <StatusBadge status={selectedReport.status} />
                      </div>
                    </div>
                  </div>

                  {selectedReport?.notes && (
                    <div className="space-y-3">
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">AI Field Observations</p>
                      <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 italic text-slate-300 text-sm leading-relaxed">
                        "{selectedReport.notes}"
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button className="flex-1 py-5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-3">
                      <Zap size={20} /> Dispatch Repair Unit
                    </button>
                    <button 
                      onClick={() => setShowAIExplanation(true)}
                      className="px-6 py-5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all border border-slate-700 active:scale-95 md:hidden"
                    >
                      <Bot size={20} />
                    </button>
                    <button 
                      onClick={() => downloadReport(selectedReport.id)}
                      className="px-6 py-5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all border border-slate-700 active:scale-95"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailBox = ({ icon, label, value }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-slate-500">
      {icon}
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-white font-bold capitalize">{value}</p>
  </div>
);

const FilterButton = ({ active, onClick, label, color }) => (
  <button 
    onClick={onClick}
    className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
      active 
        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105' 
        : `text-slate-500 hover:text-white hover:bg-slate-900 ${color}`
    }`}
  >
    {label}
  </button>
);

const SeverityBadge = ({ severity }) => {
  const styles = {
    minor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    moderate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    severe: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };
  return (
    <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${styles[severity] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const statusColors = {
    reported: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    assigned: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    in_progress: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };
  return (
    <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${statusColors[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

export default ReportsPage;
