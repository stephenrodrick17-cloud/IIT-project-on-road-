import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Phone, MapPin, TrendingUp, Home
} from 'lucide-react';
import API from '../services/api';

const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [parking, setParking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [servRes, parkRes] = await Promise.all([
          API.get('/datasets/services?latitude=28.6139&longitude=77.2090'),
          API.get('/datasets/parking')
        ]);
        // API returns data directly
        setServices(Array.isArray(servRes) ? servRes : servRes.data || []);
        setParking(Array.isArray(parkRes) ? parkRes : parkRes.data || []);
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const serviceTypes = [...new Set(services.map(s => s.service_type))];
  const zones = [...new Set(parking.map(p => p.zone))];

  const filteredServices = services.filter(s =>
    (selectedType === 'all' || s.service_type === selectedType)
  );

  const filteredParking = parking.filter(p =>
    (selectedZone === 'all' || p.zone === selectedZone)
  );

  const totalAvailable = filteredParking.reduce((sum, p) => sum + p.available_spaces, 0);
  const totalSpaces = filteredParking.reduce((sum, p) => sum + p.total_spaces, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pt-20 pb-8">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-black text-white mb-2">🛣️ Road Services & Facilities</h1>
          <p className="text-slate-400">Real-time parking availability and emergency services network</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Services', value: services.length, color: 'blue', icon: Zap },
            { label: 'Parking Zones', value: zones.length, color: 'green', icon: MapPin },
            { label: 'Available Spots', value: totalAvailable, color: 'emerald', icon: Home },
            { label: 'Utilization', value: `${((totalSpaces - totalAvailable) / totalSpaces * 100).toFixed(1)}%`, color: 'orange', icon: TrendingUp }
          ].map((stat, i) => {
            const Icon = stat.icon;
            const colors = {
              blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
              green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
              emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
              orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400'
            };
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-gradient-to-br ${colors[stat.color]} border rounded-2xl p-6`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{stat.label}</p>
                    <p className={`text-3xl font-black ${colors[stat.color].split(' ')[1]}`}>{stat.value}</p>
                  </div>
                  <Icon className={`w-12 h-12 ${colors[stat.color].split(' ')[1]}`} opacity={0.5} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Services Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-3xl p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-400" />
              Emergency & Road Services
            </h2>
            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-700/50 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types</option>
                {serviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-3 text-center py-8">
                <p className="text-slate-400">Loading services...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="col-span-3 text-center py-8">
                <p className="text-slate-400">No services found</p>
              </div>
            ) : (
              filteredServices.slice(0, 12).map((service, i) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -5 }}
                  className="bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-blue-500/50 rounded-xl p-5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-bold text-sm">{service.service_type}</h3>
                      <p className="text-slate-400 text-xs mt-1">{service.location}</p>
                    </div>
                    <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">
                      {service.distance_km.toFixed(1)} km
                    </div>
                  </div>

                  <div className="space-y-2 mb-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rating:</span>
                      <span className="text-yellow-400">⭐ {service.rating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className={service.open_status ? 'text-green-400' : 'text-red-400'}>
                        {service.open_status ? '🟢 Open' : '🔴 Closed'}
                      </span>
                    </div>
                  </div>

                  <button className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <Phone size={14} />
                    Contact
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Parking Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-3xl p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <MapPin className="w-8 h-8 text-green-400" />
              Parking Management
            </h2>
            <div className="flex gap-2">
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="bg-slate-700/50 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-green-500"
              >
                <option value="all">All Zones</option>
                {zones.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParking.map((spot, i) => {
              const utilization = ((spot.total_spaces - spot.available_spaces) / spot.total_spaces) * 100;
              const isCritical = utilization > 80;
              const isLow = spot.available_spaces < 5;

              return (
                <motion.div
                  key={spot.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -5 }}
                  className={`rounded-xl p-5 transition-all border ${
                    isCritical
                      ? 'bg-red-500/10 border-red-500/50'
                      : isLow
                      ? 'bg-yellow-500/10 border-yellow-500/50'
                      : 'bg-slate-700/30 border-slate-600/50 hover:border-green-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-bold text-sm">{spot.location}</h3>
                      <p className="text-slate-400 text-xs mt-1">{spot.zone}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                      isLow
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {spot.available_spaces}/{spot.total_spaces}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${utilization}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full ${
                          isCritical
                            ? 'bg-red-500'
                            : isLow
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                      />
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                      {utilization.toFixed(1)}% utilized
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
                    <span>₹{spot.pricing}/hr</span>
                    <span>{spot.available_spaces === 0 ? '🔴 Full' : '🟢 Available'}</span>
                  </div>

                  <button className="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 py-2 rounded-lg text-xs font-bold transition-all">
                    Reserve Now
                  </button>
                </motion.div>
              );
            })}
          </div>

          {filteredParking.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400">No parking zones found</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ServicesPage;
