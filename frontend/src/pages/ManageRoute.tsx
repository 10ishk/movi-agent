import React, { useState, useEffect } from 'react';
import { MOCK_ROUTES } from '../constants';
import type { Route } from '../types';
import MoviWidget from '../components/MoviWidget';

const HistoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"></path><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const FilterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;
const MoreVerticalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

const HeaderButton: React.FC<{ children: React.ReactNode; primary?: boolean }> = ({ children, primary }) => {
  const baseClasses = 'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue';
  const primaryClasses = 'bg-brand-blue text-white hover:bg-brand-blue-light';
  const secondaryClasses = 'bg-white border border-brand-gray-300 hover:bg-brand-gray-50';
  return (
    <button className={`${baseClasses} ${primary ? primaryClasses : secondaryClasses}`}>
      {children}
    </button>
  );
};

const ManageRoute: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'deactivated'>('active');
  const [routes, setRoutes] = useState<Route[]>(MOCK_ROUTES);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Load routes from backend so UI + bot share the same data
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        setLoadingRoutes(true);
        setRoutesError(null);

        const res = await fetch('/api/routes');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          // keep mock data if backend empty
          return;
        }

        const mapped: Route[] = data.map((r: any, index: number): Route => {
          const name: string =
            r.name ??
            r.route_display_name ??
            `Route ${r.route_id ?? index + 1}`;

          const rawDir: string | undefined =
            r.direction ?? r.route_direction;
          const direction: Route['direction'] =
            rawDir === 'LOGIN' || rawDir === 'LOGOUT'
              ? rawDir
              : 'LOGIN';

          return {
            id: Number(r.id ?? r.route_id ?? index),
            name,
            direction,
            shiftTime: r.shiftTime ?? r.shift_time ?? '00:00',
            startPoint: r.startPoint ?? r.start_stop_name ?? 'Unknown',
            endPoint: r.endPoint ?? r.end_stop_name ?? 'Unknown',
            capacity:
              typeof r.capacity === 'number' ? r.capacity : 0,
            allowedWaitlist: Boolean(
              r.allowedWaitlist ?? r.allowed_waitlist,
            ),
            someOtherCheck: Boolean(r.someOtherCheck),
          };
        });

        setRoutes(mapped);
      } catch (err) {
        console.error('Failed to load routes from backend', err);
        setRoutesError('Could not load routes from backend, showing mock data instead.');
      } finally {
        setLoadingRoutes(false);
      }
    };

    loadRoutes();
  }, []);

  const displayedRoutes = routes; // later you can filter by active/deactivated

  return (
    <div className="flex-1 flex flex-col h-full p-6 bg-white">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="text" placeholder="Search route name or ID" className="pl-4 pr-4 py-2 border rounded-md w-72" />
          </div>
          <HeaderButton><FilterIcon /> Filters</HeaderButton>
        </div>
        <div className="flex items-center gap-2">
          <HeaderButton><HistoryIcon /> History</HeaderButton>
          <HeaderButton><DownloadIcon /> Download</HeaderButton>
          <HeaderButton primary><PlusIcon /> Routes</HeaderButton>
        </div>
      </header>

      <div className="border-b border-brand-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('active')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'active'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-gray-500 hover:text-brand-gray-700 hover:border-brand-gray-300'
              }`}
          >
            Active Routes
          </button>
          <button
            onClick={() => setActiveTab('deactivated')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'deactivated'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-gray-500 hover:text-brand-gray-700 hover:border-brand-gray-300'
              }`}
          >
            Deactivated Routes
          </button>
        </nav>
      </div>

      {loadingRoutes && (
        <div className="pb-2 text-xs text-brand-gray-500">
          Loading routes from backend...
        </div>
      )}
      {routesError && (
        <div className="pb-2 text-xs text-red-600">
          {routesError}
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-gray-200">
          <thead className="bg-brand-gray-50">
            <tr>
              {['Route ID', 'Route Name', 'Direction', 'Shift Time', 'Route Start Point', 'Route End Point', 'Capacity', 'Allowed Waitlist', 'Action'].map(header => (
                <th
                  key={header}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-brand-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-brand-gray-200">
            {displayedRoutes.map((route) => (
              <tr key={route.id} className="hover:bg-brand-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-gray-900">{route.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">{route.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">{route.direction}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">{route.shiftTime}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">{route.startPoint}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">{route.endPoint}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">{route.capacity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">
                  {route.allowedWaitlist ? <CheckIcon /> : <XIcon />}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-gray-500">
                  <button><MoreVerticalIcon /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="py-4 flex items-center justify-between text-sm text-brand-gray-600">
        <div>
          Rows per page: <select className="p-1 border rounded-md"><option>25</option></select>
        </div>
        <div className="flex items-center gap-4">
          <span>Showing 1 - {displayedRoutes.length} of {displayedRoutes.length} items</span>
          <div className="flex items-center gap-2">
            <button>&lt;</button>
            <button className="px-2 py-1 bg-brand-blue text-white rounded">1</button>
            <button>2</button>
            <button>3</button>
            <button>&gt;</button>
          </div>
        </div>
      </footer>

      <MoviWidget currentPage="manageRoute" />
    </div>
  );
};

export default ManageRoute;
