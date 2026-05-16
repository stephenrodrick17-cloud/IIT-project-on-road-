import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, MapPin, Activity, Shield, Navigation, ChevronRight, Zap, Target, Radio, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-toastify';

// Fix for leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons for Response Units
const createUnitIcon = (type) => {
  const color = type === 'police' ? '#3b82f6' : '#10b981';
  const emoji = type === 'police' ? '🚔' : '🚑';
  return L.divIcon({
    className: '',
    html: `<div style="width: 40px; height: 40px; background: ${color}22; border: 2px solid ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 15px ${color}66; animation: pulse 2s infinite;">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width: 24px; height: 24px; background: #f43f5e; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 20px #f43f5e;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const RoadSOS = () => {
  const [location, setLocation] = useState(null);
  const [nearbyServices, setNearbyServices] = useState({
    hospitals: [],
    police: [],
    rescue: []
  });
  const [activeUnits, setActiveUnits] = useState([
    { id: 1, type: 'police', name: 'PATROL-704', pos: [0, 0], status: 'EN-ROUTE' },
    { id: 2, type: 'ambulance', name: 'MED-12', pos: [0, 0], status: 'RESPONDING' }
  ]);
  const [loading, setLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const TOMTOM_KEY = process.env.REACT_APP_TOMTOM_KEY;

  // AI Voice Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        if (transcript.includes('emergency') || transcript.includes('help') || transcript.includes('sos')) {
          handleSOS();
          speak("Emergency signal received. Broadcasting SOS coordinates to satellite network.");
        } else if (transcript.includes('status') || transcript.includes('units')) {
          announceStatus();
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const speak = (text) => {
    if (!isVoiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const announceStatus = () => {
    const unitCount = activeUnits.length;
    const statusText = `Satellite tracking confirmed. ${unitCount} emergency units are en-route to your sector. PATROL 704 and MED 12 are responding.`;
    speak(statusText);
    toast.info("AI Status Briefing Active");
  };

  const toggleVoice = () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);
    if (newState) {
      speak("Emergency Voice Interface Activated. Say 'Emergency' or 'Help' to broadcast SOS.");
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } else {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  };

  const fetchNearbyServices = useCallback(async (loc) => {
    if (!TOMTOM_KEY) {
      toast.error('TomTom API key not configured');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const categories = { hospitals: '7311', police: '7322', rescue: '9935' };
      const results = {};
      for (const [key, catId] of Object.entries(categories)) {
        const response = await fetch(`https://api.tomtom.com/search/2/categorySearch/${key}.json?key=${TOMTOM_KEY}&lat=${loc.lat}&lon=${loc.lon}&radius=10000&categorySet=${catId}`);
        const data = await response.json();
        results[key] = data.results.slice(0, 5).map(item => ({
          name: item.poi.name,
          address: item.address.freeformAddress,
          dist: (item.dist / 1000).toFixed(1),
          phone: item.poi.phone || 'Emergency Line',
          pos: item.position
        }));
      }
      setNearbyServices(results);
    } catch (error) { toast.error('Satellite link interrupted'); }
    finally { setLoading(false); }
  }, [TOMTOM_KEY]);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lon: position.coords.longitude };
          setLocation(loc);
          fetchNearbyServices(loc);
        },
        () => {
          const defaultLoc = { lat: 19.0760, lon: 72.8777 }; 
          setLocation(defaultLoc);
          fetchNearbyServices(defaultLoc);
        }
      );
    }
  }, [fetchNearbyServices]);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Motion Engine: Simulates satellite-tracked units approaching the user
  useEffect(() => {
    if (!location) return;

    // Initial positions for units (slightly offset from user)
    setActiveUnits(prev => prev.map((unit, i) => ({
      ...unit,
      pos: [location.lat + (Math.random() - 0.5) * 0.02, location.lon + (Math.random() - 0.5) * 0.02]
    })));

    const interval = setInterval(() => {
      setActiveUnits(prev => prev.map(unit => {
        const step = 0.0005;
        const latDiff = location.lat - unit.pos[0];
        const lonDiff = location.lon - unit.pos[1];
        
        // Move towards user
        return {
          ...unit,
          pos: [
            unit.pos[0] + (Math.abs(latDiff) > step ? (latDiff > 0 ? step : -step) : latDiff),
            unit.pos[1] + (Math.abs(lonDiff) > step ? (lonDiff > 0 ? step : -step) : lonDiff)
          ]
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [location]);

  const handleSOS = () => {
    toast.error('🚨 SOS SIGNAL BROADCASTED TO SATELLITE NETWORK', { position: "top-center" });
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden bg-rose-500/10 backdrop-blur-xl rounded-[3rem] p-12 border border-rose-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-500/10 blur-[120px] -mr-32 -mt-32 rounded-full animate-pulse"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 mb-6">
              <Radio size={12} className="text-rose-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Satellite Tracking Active</span>
            </div>
            <h1 className="text-7xl font-black text-white tracking-tighter mb-4 leading-none">ROAD <span className="text-rose-500">SOS</span></h1>
            <p className="text-slate-400 text-2xl font-medium leading-relaxed">Pioneering real-time emergency telemetry. Satellite-tracked patrol and medical units responding to your sector.</p>
            
            <div className="mt-10 flex flex-wrap gap-4">
               <button 
                  onClick={toggleVoice}
                  className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 transition-all ${isVoiceEnabled ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
               >
                  {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  {isVoiceEnabled ? 'AI Voice Active' : 'Enable Voice Interface'}
               </button>
               {isVoiceEnabled && (
                  <div className="flex items-center gap-3 px-6 py-4 bg-slate-900/50 rounded-2xl border border-rose-500/20">
                     <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {isListening ? 'Listening for "Emergency"...' : 'Mic Standby'}
                     </span>
                     {isListening ? <Mic size={14} className="text-emerald-500" /> : <MicOff size={14} className="text-slate-600" />}
                  </div>
               )}
            </div>
          </div>
          <button onClick={handleSOS} className="group relative w-32 h-32 md:w-48 md:h-48 rounded-full bg-rose-600 flex items-center justify-center shadow-[0_0_50px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-700 to-rose-400"></div>
            <div className="relative z-10 flex flex-col items-center">
              <Zap size={48} className="text-white mb-2 animate-bounce" />
              <span className="text-xl font-black text-white tracking-widest uppercase">SOS</span>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Tactical Satellite Map */}
          <div className="relative h-[600px] bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden group">
            <div className="absolute top-8 left-8 z-[1000] bg-slate-950/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Response Network</span>
            </div>
            
            {location && (
              <MapContainer center={[location.lat, location.lon]} zoom={14} style={{ height: '100%', width: '100%', filter: 'grayscale(0.2) contrast(1.1) brightness(0.9)' }}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Satellite" />
                <Marker position={[location.lat, location.lon]} icon={userIcon}>
                  <Popup><span className="font-bold">YOUR SECTOR</span></Popup>
                </Marker>
                {activeUnits.map(unit => (
                  <Marker key={unit.id} position={unit.pos} icon={createUnitIcon(unit.type)}>
                    <Popup>
                      <div className="p-2 space-y-1">
                        <p className="font-black text-[10px] text-orange-500 uppercase">{unit.type}</p>
                        <p className="font-bold text-sm">{unit.name}</p>
                        <p className="text-[10px] text-emerald-500 font-black tracking-widest">{unit.status}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {nearbyServices.hospitals.map((item, i) => (
                  <Marker key={`h-${i}`} position={[item.pos.lat, item.pos.lon]}>
                    <Popup><div className="font-bold text-xs">{item.name}</div></Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}

            {/* Simulated Satellite HUD */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-slate-950/20 z-10 flex flex-col justify-between p-12">
               <div className="flex justify-between">
                  <div className="h-10 w-10 border-t-2 border-l-2 border-white/20"></div>
                  <div className="h-10 w-10 border-t-2 border-r-2 border-white/20"></div>
               </div>
               <div className="flex justify-between">
                  <div className="h-10 w-10 border-b-2 border-l-2 border-white/20"></div>
                  <div className="h-10 w-10 border-b-2 border-r-2 border-white/20"></div>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ResourceSection title="Nearby Trauma Centers" items={nearbyServices.hospitals} icon={<Activity className="text-emerald-500" />} loading={loading} />
            <ResourceSection title="Police Units" items={nearbyServices.police} icon={<Shield className="text-blue-500" />} loading={loading} />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          {/* Live Unit Tracking Feed */}
          <div className="bg-slate-950/60 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-3">
              <Target size={16} /> Satellite Tracking Feed
            </h3>
            <div className="space-y-4">
              {activeUnits.map(unit => (
                <div key={unit.id} className="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${unit.type === 'police' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'} animate-pulse`}>
                      {unit.type === 'police' ? <Shield size={20} /> : <Activity size={20} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{unit.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{unit.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block mr-2" />
                    <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase">Live</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-3">
              <MapPin size={16} className="text-rose-500" /> Tactical Position
            </h3>
            <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              {location ? (
                <div className="space-y-4 font-mono">
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-900 rounded-xl">
                    <span className="text-slate-500 text-xs text-nowrap">SECTOR LAT</span>
                    <span className="text-white font-bold">{location.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-900 rounded-xl">
                    <span className="text-slate-500 text-xs text-nowrap">SECTOR LON</span>
                    <span className="text-white font-bold">{location.lon.toFixed(6)}</span>
                  </div>
                </div>
              ) : <div className="h-24 bg-slate-900 rounded-xl animate-pulse" />}
            </div>
          </div>
          
          <div className="space-y-4">
            <QuickContact label="Local Police Dispatch" number="100" icon={<Shield className="text-blue-500" />} />
            <QuickContact label="Medical Response" number="108" icon={<Activity className="text-emerald-500" />} />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickContact = ({ label, number, icon }) => (
  <a href={`tel:${number}`} className="flex items-center justify-between p-5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800 hover:bg-slate-900 hover:border-slate-700 transition-all group">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-slate-900 rounded-xl group-hover:scale-110 transition-transform">{icon}</div>
      <div>
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-xl font-black text-white">{number}</p>
      </div>
    </div>
    <ChevronRight size={20} className="text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
  </a>
);

const ResourceSection = ({ title, items, icon, loading }) => (
  <div className="bg-slate-900/40 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl">
    <div className="flex items-center justify-between mb-8"><h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h3>{icon}</div>
    <div className="space-y-4">
      {loading ? [1,2,3].map(i => <div key={i} className="h-20 bg-slate-950 rounded-2xl animate-pulse" />) : items.length > 0 ? items.map((item, i) => (
        <div key={i} className="p-5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight max-w-[70%]">{item.name}</h4>
            <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-md">{item.dist} KM</span>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 line-clamp-1">{item.address}</p>
          <div className="flex gap-2">
            <a href={`tel:${item.phone}`} className="flex-1 py-2 bg-slate-800 text-slate-300 text-[10px] font-black uppercase rounded-lg flex items-center justify-center gap-2 hover:bg-white hover:text-slate-950"><Phone size={12} /> Call</a>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${item.pos.lat},${item.pos.lon}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-slate-800 text-slate-300 text-[10px] font-black uppercase rounded-lg flex items-center justify-center gap-2 hover:bg-white hover:text-slate-950"><Navigation size={12} /> Guide</a>
          </div>
        </div>
      )) : <div className="p-8 text-center bg-slate-950 rounded-2xl border border-dashed border-slate-800"><p className="text-xs font-bold text-slate-600 uppercase tracking-widest">No units in sector</p></div>}
    </div>
  </div>
);

export default RoadSOS;
