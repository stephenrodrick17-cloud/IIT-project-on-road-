import React, { useState, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
  Upload, Camera, MapPin, AlertCircle, FileVideo, Play, Pause, 
  RefreshCw, BarChart3, LayoutGrid, Zap, Bot, Sparkles, Download,
  Activity, Shield, Target, Cpu, Eye, Info, ChevronRight, Gauge,
  TrendingUp, PieChart as PieIcon, Crosshair
} from 'lucide-react';
import { toast } from 'react-toastify';
import API from '../services/api';
import { useAIChat } from '../components/AIChatContext';
import { validateFile, isValidGPSCoordinates } from '../utils/constants';

const DetectionPage = () => {
  const [activeTab, setActiveTab] = useState('image'); // 'image', 'video', 'realtime'
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [roadType, setRoadType] = useState('city_street');
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  
  // Shared AI context
  const { setAnalysisContext } = useAIChat();
  
  // Real-time detection states
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [realtimeDetections, setRealtimeDetections] = useState([]);
  const [webcamStream, setWebcamStream] = useState(null);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const realtimeTimerRef = useRef(null);

  const loadingSteps = [
    "Initializing Neural Core...",
    "Loading YOLOv8 Weights...",
    "Scanning Visual Telemetry...",
    "Extracting Structural Anomalies...",
    "Calculating Economic Impact...",
    "Finalizing Strategic Report..."
  ];

  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 1500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (realtimeTimerRef.current) {
        clearInterval(realtimeTimerRef.current);
      }
      stopWebcam();
    };
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setResult(null);
    setHighlightedIndex(null);
  };

  const getGPSLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not available');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        toast.success('Geospatial lock established');
      },
      () => {
        toast.error('Failed to acquire GPS lock');
      }
    );
  };

  const handleDetect = async () => {
    if (!selectedFile) {
      toast.error(`Select a ${activeTab} source`);
      return;
    }

    if (gpsLocation && !isValidGPSCoordinates(gpsLocation.latitude, gpsLocation.longitude)) {
      toast.error('GPS out of operational range (India)');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (gpsLocation?.latitude) formData.append('latitude', gpsLocation.latitude);
      if (gpsLocation?.longitude) formData.append('longitude', gpsLocation.longitude);
      if (roadType) formData.append('road_type', roadType);

      let response;
      if (activeTab === 'image') {
        response = await API.detectDamage(formData, null);
      } else if (activeTab === 'video') {
        response = await API.detectVideo(formData);
      }

      setResult(response);

      if (activeTab === 'image') {
        if (response?.summary?.total_damage_areas > 0) {
          toast.success(`Neural scan found ${response.summary.total_damage_areas} anomalies`);
          setAnalysisContext({
            detections: response.detections,
            summary: response.summary,
            road_type: roadType,
            location: gpsLocation,
          });
        } else {
          toast.info('No structural anomalies detected');
          setAnalysisContext(null);
        }
      } else {
        toast.success('Video intelligence stream processed');
      }
    } catch (error) {
      toast.error(`Neural Link Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startWebcam = async () => {
    try {
      const constraints = { video: { width: 1280, height: 720, facingMode: "environment" } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
      setIsRealtimeActive(false);
      toast.success('Optical sensors online');
    } catch (error) {
      toast.error('Sensor Init Failed: ' + error.message);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setIsRealtimeActive(false);
    if (realtimeTimerRef.current) clearInterval(realtimeTimerRef.current);
  };

  const toggleRealtime = () => {
    if (isRealtimeActive) {
      setIsRealtimeActive(false);
      clearInterval(realtimeTimerRef.current);
    } else {
      if (!webcamStream) {
        toast.error('Initialize sensors first');
        return;
      }
      setIsRealtimeActive(true);
      realtimeTimerRef.current = setInterval(processCurrentFrame, 1000);
    }
  };

  const processCurrentFrame = async () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      canvasRef.current.toBlob(async (blob) => {
        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('file', file);
        try {
          const response = await API.detectFrame(formData);
          if (response.success) setRealtimeDetections(response.detections);
        } catch (error) {
          console.error('Frame Sync Error:', error);
        }
      }, 'image/jpeg');
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const imageData = canvasRef.current.toDataURL('image/jpeg');
      canvasRef.current.toBlob((blob) => {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreview(imageData);
        setActiveTab('image');
        setResult(null);
      });
    }
  };

  const getChartData = () => {
    if (!result || !result.detections) return { costData: [], distributionData: [], radarData: [] };
    
    // Cost by damage type
    const costByType = result.detections.reduce((acc, det) => {
      const type = det.damage_type;
      acc[type] = (acc[type] || 0) + (det.cost_estimation?.total_cost || 0);
      return acc;
    }, {});
    
    const costData = Object.keys(costByType).map(type => ({
      name: type.replace('_', ' ').toUpperCase(),
      value: costByType[type]
    }));

    // Severity distribution
    const severityCount = result.detections.reduce((acc, det) => {
      acc[det.severity] = (acc[det.severity] || 0) + 1;
      return acc;
    }, {});

    const distributionData = Object.keys(severityCount).map(sev => ({
      name: sev.toUpperCase(),
      value: severityCount[sev]
    }));

    // Radar data (average metrics)
    const avgConfidence = (result.summary.avg_confidence || 0.85) * 100;
    const maxSeverity = result.detections.some(d => d.severity === 'severe') ? 100 : result.detections.some(d => d.severity === 'moderate') ? 60 : 30;
    const costImpact = Math.min(100, (result.summary.total_estimated_cost / 50000) * 100);
    
    const radarData = [
      { subject: 'Confidence', A: avgConfidence, fullMark: 100 },
      { subject: 'Severity', A: maxSeverity, fullMark: 100 },
      { subject: 'Cost Impact', A: costImpact, fullMark: 100 },
      { subject: 'Density', A: Math.min(100, result.summary.total_damage_areas * 20), fullMark: 100 },
      { subject: 'Structural Risk', A: (maxSeverity + costImpact) / 2, fullMark: 100 }
    ];

    return { costData, distributionData, radarData };
  };

  const { costData, distributionData, radarData } = getChartData();
  const CHART_COLORS = ['#f97316', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];

  const handleDownloadReport = () => {
    if (!result) return;
    const { summary, detections } = result;
    const reportText = `ROADGUARD AI INTELLIGENCE REPORT\nID: RG-${Math.random().toString(36).substr(2, 9).toUpperCase()}\nDate: ${new Date().toLocaleString()}\nLocation: ${gpsLocation ? `${gpsLocation.latitude}, ${gpsLocation.longitude}` : 'N/A'}\n\nSUMMARY:\nTotal Anomalies: ${summary.total_damage_areas}\nEconomic Valuation: ₹${summary.total_estimated_cost.toLocaleString()}\nConfidence Index: ${(summary.avg_confidence * 100).toFixed(1)}%\n\nDETECTIONS:\n${detections.map((d, i) => `${i+1}. ${d.damage_type} (${d.severity.toUpperCase()}) - ${d.confidence.toFixed(2)} confidence`).join('\n')}\n\nStrategic Recommendation: Immediate intervention required for severe structural failures.`;
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RG_Analysis_${Date.now()}.txt`;
    link.click();
    toast.success('Strategic report exported');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* High-Tech Header */}
      <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-10 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 flex items-center gap-4 opacity-50">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Status</p>
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-2 justify-end">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              OPERATIONAL
            </p>
          </div>
          <Cpu className="text-slate-700 w-10 h-10" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
              <Activity size={12} className="text-orange-500" />
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Neural Diagnostic Suite</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tighter mb-4 leading-none uppercase">
              Visual <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">Intelligence</span>
            </h1>
            <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-2xl">
              Execute deep neural analysis on infrastructure telemetry. Deploy YOLOv8 
              models to identify, categorize, and value structural anomalies in real-time.
            </p>
          </div>
          
          <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex gap-1 shadow-2xl">
            {['image', 'video', 'realtime'].map(tab => (
              <button 
                key={tab}
                onClick={() => { setActiveTab(tab); setResult(null); setSelectedFile(null); setPreview(null); if(tab !== 'realtime') stopWebcam(); }}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === tab ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
              >
                {tab === 'image' && <Upload size={14} />}
                {tab === 'video' && <FileVideo size={14} />}
                {tab === 'realtime' && <Camera size={14} />}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Visual Terminal */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-1.5 border border-slate-800 shadow-2xl overflow-hidden relative min-h-[600px] group">
            {/* HUD Elements */}
            <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
              <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Feed: {activeTab.toUpperCase()}</span>
              </div>
              <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Res: 1280x720</span>
              </div>
            </div>

            <div className="absolute top-6 right-6 z-20">
              <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                <Target className="w-5 h-5 text-orange-500 animate-pulse" />
              </div>
            </div>

            {/* Viewport */}
            <div className="w-full h-full rounded-[2.2rem] overflow-hidden bg-slate-950 flex flex-col items-center justify-center relative">
              {activeTab !== 'realtime' ? (
                preview ? (
                  <div className="w-full h-full relative group/preview flex items-center justify-center">
                    {activeTab === 'image' ? (
                      <img src={result?.annotated_image_url || preview} alt="Analysis" className="max-w-full max-h-[600px] object-contain transition-all duration-700" />
                    ) : (
                      <video src={preview} controls className="max-w-full max-h-[600px] object-contain" />
                    )}
                    
                    {/* Visual Overlay for results */}
                    {result && activeTab === 'image' && (
                      <div className="absolute inset-0 pointer-events-none">
                         <div className="absolute inset-0 border-4 border-emerald-500/20 animate-pulse" />
                         {/* We could render boxes here if we had normalized coordinates */}
                      </div>
                    )}

                    {!loading && (
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/preview:opacity-100 transition-all duration-300 backdrop-blur-md flex items-center justify-center">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white text-slate-950 px-8 py-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-105 transition-transform"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Replace Telemetry
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full border-2 border-dashed border-slate-800 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all flex flex-col items-center justify-center p-20 cursor-pointer"
                  >
                    <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center mb-8 shadow-2xl border border-slate-800 group-hover:scale-110 transition-all duration-500">
                      {activeTab === 'image' ? <Upload className="text-orange-500 w-10 h-10" /> : <FileVideo className="text-orange-500 w-10 h-10" />}
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Awaiting Feed Input</h3>
                    <p className="text-slate-500 text-center max-w-sm font-medium leading-relaxed">
                      Drag and drop high-resolution structural telemetry or click to browse local archives.
                    </p>
                    <div className="mt-10 flex gap-4">
                      {['4K', 'RAW', 'LOG'].map(tag => (
                        <span key={tag} className="px-4 py-1.5 bg-slate-900 text-slate-500 text-[10px] font-black rounded-lg border border-slate-800 tracking-widest uppercase">{tag}</span>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="w-full h-full relative">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ display: webcamStream ? 'block' : 'none' }} />
                  <canvas ref={canvasRef} className="hidden" width="1280" height="720" />
                  
                  {isRealtimeActive && realtimeDetections.map((det, idx) => (
                    <div 
                      key={idx}
                      className="absolute border-2 border-orange-500 pointer-events-none animate-in fade-in duration-300 shadow-[0_0_20px_rgba(249,115,22,0.5)]"
                      style={{
                        left: `${det.bbox[0] * 100}%`,
                        top: `${det.bbox[1] * 100}%`,
                        width: `${(det.bbox[2] - det.bbox[0]) * 100}%`,
                        height: `${(det.bbox[3] - det.bbox[1]) * 100}%`,
                        borderRadius: '2px'
                      }}
                    >
                      <div className="absolute -top-8 left-0 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-2 whitespace-nowrap uppercase tracking-tighter">
                        <Zap size={10} className="fill-white" />
                        {det.damage_type} • {(det.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}

                  {!webcamStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl">
                      <div className="w-24 h-24 bg-slate-800 rounded-[2rem] flex items-center justify-center mb-8 border border-slate-700 shadow-2xl">
                        <Eye className="w-12 h-12 text-slate-600" />
                      </div>
                      <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs mb-10">Sensors Deactivated</p>
                      <button 
                        onClick={startWebcam}
                        className="px-10 py-4 bg-orange-500 text-white font-black rounded-2xl hover:bg-orange-600 transition-all shadow-2xl shadow-orange-500/20 uppercase tracking-widest text-xs"
                      >
                        Initiate Optical Link
                      </button>
                    </div>
                  )}

                  {webcamStream && (
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-slate-950/90 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 shadow-2xl transition-all group-hover:scale-105">
                      <button 
                        onClick={toggleRealtime}
                        className={`px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all ${isRealtimeActive ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}
                      >
                        {isRealtimeActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        {isRealtimeActive ? 'Deactivate Neural Link' : 'Activate Neural Link'}
                      </button>
                      <div className="w-px h-10 bg-white/10" />
                      <button onClick={captureFrame} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"><Camera size={20} /></button>
                      <button onClick={stopWebcam} className="p-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all"><RefreshCw size={20} /></button>
                    </div>
                  )}
                </div>
              )}

              {/* Loading State Overlay */}
              {loading && (
                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-12">
                  <div className="relative mb-12">
                    <div className="w-32 h-32 border-4 border-slate-800 rounded-full" />
                    <div className="absolute inset-0 w-32 h-32 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
                    <div className="absolute inset-4 w-24 h-24 border-4 border-orange-500/30 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
                    <Cpu className="absolute inset-0 m-auto w-10 h-10 text-orange-500 animate-pulse" />
                  </div>
                  <div className="text-center space-y-4">
                    <h3 className="text-2xl font-black text-white uppercase tracking-widest">Neural Analysis in Progress</h3>
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-orange-500 font-bold text-sm h-6">{loadingSteps[loadingStep]}</p>
                      <div className="w-64 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-orange-500 transition-all duration-1000 ease-out" 
                          style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept={activeTab === 'image' ? 'image/*' : 'video/*'} onChange={handleFileSelect} className="hidden" />
          </div>

          {activeTab !== 'realtime' && selectedFile && !loading && !result && (
            <button
              onClick={handleDetect}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-orange-500/30 transition-all active:scale-[0.98] uppercase tracking-[0.4em] text-xs flex items-center justify-center gap-4"
            >
              <Zap size={18} className="fill-white" />
              Execute Structural Diagnostics
            </button>
          )}

          {/* New Visualization Section - Moved from Sidebar to under Feed */}
          {result && (
            <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl space-y-8 animate-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20"><Activity size={20} className="text-white" /></div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Structural Analysis Matrix</h3>
                </div>
                <div className="flex items-center gap-2">
                   <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">Neural Link Sync</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Expenditure Analysis */}
                <div className="space-y-4 md:col-span-2 lg:col-span-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={12} className="text-orange-500" /> Expenditure Analysis</p>
                  <div className="h-[250px] w-full bg-slate-950/50 rounded-3xl p-6 border border-slate-800">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#f97316' }}
                          formatter={(value) => `₹${value.toLocaleString()}`}
                        />
                        <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Severity Mix */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><PieIcon size={12} className="text-orange-500" /> Severity Mix</p>
                  <div className="h-[250px] bg-slate-950/50 rounded-3xl border border-slate-800 flex items-center justify-center p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Analysis Radar */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Crosshair size={12} className="text-orange-500" /> Analysis Radar</p>
                  <div className="h-[250px] bg-slate-950/50 rounded-3xl border border-slate-800 flex items-center justify-center p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
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
          )}
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Diagnostic Controls */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl space-y-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-6">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Telemetry Config</h3>
              <Gauge size={16} className="text-slate-600" />
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={12} className="text-orange-500" /> Geospatial Lock
                </label>
                <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-orange-500/30 transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GPS Coordinates</span>
                    <button onClick={getGPSLocation} className="p-2 hover:bg-slate-800 rounded-xl text-orange-500 transition-all active:rotate-180"><RefreshCw size={14} /></button>
                  </div>
                  {gpsLocation ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono"><span className="text-slate-500">LAT:</span><span className="text-white font-black">{gpsLocation.latitude.toFixed(6)}</span></div>
                      <div className="flex justify-between text-xs font-mono"><span className="text-slate-500">LON:</span><span className="text-white font-black">{gpsLocation.longitude.toFixed(6)}</span></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-700 py-2">
                      <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Signal Awaiting...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <LayoutGrid size={12} className="text-orange-500" /> Environment Zone
                </label>
                <div className="relative">
                  <select 
                    value={roadType}
                    onChange={(e) => setRoadType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="city_street">Urban Arterial</option>
                    <option value="highway">High-Velocity Expressway</option>
                    <option value="rural_road">Remote Rural Link</option>
                    <option value="bridge">Structural Bridge Span</option>
                  </select>
                  <ChevronRight size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Output */}
          {result && (
            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in duration-500">
              <div className="p-8 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20"><BarChart3 size={20} className="text-white" /></div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Analysis Vector</h3>
                </div>
                <button onClick={handleDownloadReport} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"><Download size={16} /></button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Detections</p>
                    <p className="text-3xl font-black text-white">{result.summary.total_damage_areas}</p>
                  </div>
                  <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Conf. Index</p>
                    <p className="text-3xl font-black text-emerald-400">{(result.summary.avg_confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Info size={12} className="text-orange-500" /> Objects Identified</p>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {result.detections.map((det, i) => (
                      <div 
                        key={i} 
                        onMouseEnter={() => setHighlightedIndex(i)}
                        onMouseLeave={() => setHighlightedIndex(null)}
                        className={`p-4 bg-slate-950/50 rounded-2xl border transition-all cursor-crosshair ${highlightedIndex === i ? 'border-orange-500 shadow-lg shadow-orange-500/10 scale-[1.02]' : 'border-slate-800 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${det.severity === 'severe' ? 'bg-rose-500/20 text-rose-500' : det.severity === 'moderate' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>{det.severity}</span>
                          <span className="text-[10px] font-mono text-slate-500">{(det.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-black text-white uppercase tracking-tight">{det.damage_type}</p>
                          <p className="text-xs font-black text-orange-500">₹{det.cost_estimation?.total_cost.toLocaleString()}</p>
                        </div>
                        <div className="mt-3 h-1 bg-slate-900 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${det.severity === 'severe' ? 'bg-rose-500' : det.severity === 'moderate' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${det.confidence * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-orange-500/5 rounded-3xl border border-orange-500/20 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Shield size={16} className="text-orange-500" />
                    <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Recommended Protocol</h4>
                  </div>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">
                    Based on {result.summary.total_damage_areas} structural failures, the strategic priority is {result.summary.total_estimated_cost > 100000 ? 'IMMEDIATE INTERVENTION' : 'SCHEDULED MAINTENANCE'}.
                  </p>
                  <button 
                    onClick={() => setAnalysisContext(result)}
                    className="w-full py-4 bg-white text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Bot size={14} /> Brief AI Assistant <Sparkles size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* System Telemetry (Placeholder for professional look) */}
          <div className="bg-slate-950/50 rounded-[2.5rem] p-8 border border-slate-800 space-y-6 opacity-60">
             <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Telemetry</h4>
                <Activity size={12} className="text-slate-700" />
             </div>
             <div className="space-y-4">
                {[
                  { label: "Neural Load", value: "14.2ms", color: "bg-emerald-500" },
                  { label: "Memory Usage", value: "2.4GB", color: "bg-emerald-500" },
                  { label: "Buffer Sync", value: "Stable", color: "bg-emerald-500" }
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 uppercase">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-500">{item.value}</span>
                      <div className={`w-1 h-1 rounded-full ${item.color}`} />
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionPage;
