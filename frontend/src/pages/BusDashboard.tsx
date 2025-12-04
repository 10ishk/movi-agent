import React, { useState, useEffect } from 'react';
import { MOCK_TRIPS } from '../constants';
import type { Trip } from '../types';
import MoviWidget from '../components/MoviWidget';

const FilterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const HistoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"></path><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>;
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;

const HeaderButton: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <button className={`flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-brand-gray-300 rounded-md shadow-sm hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue ${className}`}>
    {children}
  </button>
);

const Tag: React.FC<{ children: React.ReactNode; count: number; color: string }> = ({ children, count, color }) => (
  <button className="flex items-center gap-2 px-3 py-1 text-sm border-b-2 border-transparent hover:border-brand-blue">
    {children}
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${color}`}>
      {count}
    </span>
  </button>
);

const TripCard: React.FC<{ trip: Trip; isSelected: boolean; onClick: () => void }> = ({ trip, isSelected, onClick }) => {
  const progressColor = trip.progress > 0 ? 'bg-green-500' : 'bg-brand-gray-300';
  return (
    <div onClick={onClick} className={`p-3 border-l-4 ${isSelected ? 'border-brand-blue bg-blue-50' : 'border-transparent bg-white'} cursor-pointer hover:bg-blue-50`}>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center">
          <input type="checkbox" className="mr-3 h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
          <p className="font-semibold text-sm text-brand-gray-800">{trip.name}</p>
        </div>
        <p className={`text-xs font-bold ${trip.progress > 0 ? 'text-green-600' : 'text-brand-gray-500'}`}>
          {trip.progress}% <span className="font-medium">booked</span>
        </p>
      </div>
      <p className="text-xs text-brand-gray-500 ml-7">{trip.time}</p>
      <div className="w-full bg-brand-gray-200 rounded-full h-1 mt-2 ml-7">
        <div className={`${progressColor} h-1 rounded-full`} style={{ width: `${trip.progress}%` }}></div>
      </div>
    </div>
  );
};

const defaultStops: Trip['stops'] = { E: 0, O: 0, V: 0, VOL: 0 };

function inferTripType(name: string): Trip['type'] {
  if (name.startsWith('Path')) return 'Path Path';
  if (name.startsWith('Groone')) return 'Groone';
  if (name.startsWith('AVX')) return 'AVX';
  if (name.startsWith('NoShow')) return 'NoShow';
  return 'Bulk';
}

const BusDashboard: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>(MOCK_TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(MOCK_TRIPS[0] ?? null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);

  // Load trips from backend so UI + bot share the same data
  useEffect(() => {
    const loadTrips = async () => {
      try {
        setLoadingTrips(true);
        setTripsError(null);

        const res = await fetch('http://localhost:5000/api/daily_trips');

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          // If backend returns nothing, keep using MOCK_TRIPS
          return;
        }

        const mapped: Trip[] = data.map((t: any, index: number): Trip => {
          const name: string =
            t.name ??
            t.display_name ??
            `Trip ${t.trip_id ?? index + 1}`;

          const type: Trip['type'] = inferTripType(name);

          const rawStatus: string | undefined = t.status;
          const status: Trip['status'] =
            rawStatus === 'IN' ||
            rawStatus === 'OUT' ||
            rawStatus === 'DELAYED' ||
            rawStatus === 'ON TIME'
              ? rawStatus
              : 'ON TIME';

          const progress =
            typeof t.progress === 'number' ? t.progress : 0;

          return {
            id: String(t.id ?? t.trip_id ?? index),
            name,
            type,
            time: t.time ?? t.shift_time ?? '00:00',
            status,
            progress,
            duration: t.duration ?? t.scheduled_duration ?? undefined,
            capacity:
              t.capacity !== undefined && t.capacity !== null
                ? String(t.capacity)
                : undefined,
            stops: t.stops ?? defaultStops,
          };
        });

        setTrips(mapped);
        setSelectedTrip(mapped[0] ?? null);
      } catch (err) {
        console.error('Failed to load trips from backend', err);
        setTripsError('Could not load trips from backend, showing mock data instead.');
      } finally {
        setLoadingTrips(false);
      }
    };

    loadTrips();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-brand-gray-100">
      {/* Header */}
      <header className="bg-white p-4 border-b border-brand-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <input type="date" defaultValue="2025-07-11" className="p-2 border rounded-md" />
          <div className="relative">
            <input type="text" placeholder="Search Name/Id" className="pl-10 pr-4 py-2 border rounded-md w-64" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-400"><SearchIcon /></span>
          </div>
          <HeaderButton><FilterIcon /> Filters</HeaderButton>
        </div>
        <div>
          <a href="#" className="text-sm text-brand-blue hover:underline">Switch to Old UI</a>
        </div>
      </header>

      {/* Tags */}
      <div className="bg-white px-4 py-2 border-b border-brand-gray-200 flex items-center gap-4">
        <Tag count={42} color="bg-orange-100 text-orange-800">Vehicles Not Assigned</Tag>
        <Tag count={43} color="bg-blue-100 text-blue-800">Trips Not Generated</Tag>
        <Tag count={11} color="bg-gray-100 text-gray-800">Employees Scheduled</Tag>
        <Tag count={1} color="bg-green-100 text-green-800">Ongoing Trips</Tag>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Trip List */}
        <aside className="w-1/3 bg-white border-r border-brand-gray-200 flex flex-col">
          <div className="p-4 border-b border-brand-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <button className="font-semibold">Track Route</button>
              <button>Generate Tripsheet</button>
              <button>Merge Route</button>
            </div>
            <div className="flex items-center gap-2">
              <HeaderButton className="bg-orange-500 text-white border-orange-500 hover:bg-orange-600"><PauseIcon /> Pause Operations</HeaderButton>
              <HeaderButton><DownloadIcon /> Download</HeaderButton>
            </div>
          </div>

          {loadingTrips && (
            <div className="p-2 text-xs text-brand-gray-500 text-center border-b border-brand-gray-200">
              Loading trips from backend...
            </div>
          )}
          {tripsError && (
            <div className="p-2 text-xs text-red-600 text-center border-b border-brand-gray-200">
              {tripsError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {trips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                isSelected={selectedTrip?.id === trip.id}
                onClick={() => setSelectedTrip(trip)}
              />
            ))}
          </div>
          <div className="p-2 border-t border-brand-gray-200 text-sm text-brand-gray-600 flex items-center justify-between">
            <span>Rows per page: <strong>25</strong></span>
            <div className="flex items-center gap-2">
              <span>1-{trips.length} of {trips.length}</span>
              <button>&lt;</button>
              <button>&gt;</button>
            </div>
          </div>
        </aside>

        {/* Right Panel: Trip Details */}
        <section className="w-2/3 p-6 flex flex-col">
          {selectedTrip ? (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold">{selectedTrip.name}</h1>
                  <p className="text-sm text-brand-gray-500">Duration: {selectedTrip.duration ?? '-'}</p>
                  <p className="text-sm text-brand-gray-500">Planned Capacity: {selectedTrip.capacity ?? '-'}</p>
                  <div className="flex gap-2 mt-2">
                    {selectedTrip.stops && Object.entries(selectedTrip.stops).map(([key, value]) => (
                      <div
                        key={key}
                        className={`px-3 py-1 rounded-md text-sm ${key === 'VOL' ? 'bg-red-100 text-red-800' : 'bg-brand-gray-200'}`}
                      >
                        {key} {value}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-brand-blue text-sm font-medium">History</button>
                  <img src="https://picsum.photos/300/150" alt="Map" className="rounded-lg shadow-md w-48 h-24 object-cover" />
                  <button className="self-end text-brand-blue"><RefreshIcon /></button>
                </div>
              </div>
              <div className="flex gap-4 mb-6">
                <button className="px-6 py-2 bg-brand-blue text-white rounded-md shadow-sm hover:bg-brand-blue-light">Manage Vehicles</button>
                <button className="px-6 py-2 bg-white border border-brand-gray-300 rounded-md shadow-sm hover:bg-brand-gray-50">Manage Bookings</button>
              </div>
              <div className="flex-1 bg-white border border-brand-gray-200 rounded-lg flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 flex items-center justify-center bg-brand-gray-100 rounded-full mb-4">
                  <svg className="w-12 h-12 text-brand-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8a1 1 0 001-1zM3 11h10M16 16V6a1 1 0 011-1h4a1 1 0 011 1v10l-2 2h-3a1 1 0 01-1-1zM16 11h6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-brand-gray-700">Vehicle not assigned yet</h3>
                <div className="flex gap-4 mt-6">
                  <button className="text-brand-blue font-medium hover:underline">Add Vendor</button>
                  <button className="text-brand-blue font-medium hover:underline">Add/Edit Vehicle</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-brand-gray-500">
              Select a trip to see details
            </div>
          )}
        </section>
      </div>
      <MoviWidget currentPage="busDashboard" />
    </div>
  );
};

export default BusDashboard;
