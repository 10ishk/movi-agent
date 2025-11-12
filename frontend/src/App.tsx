import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import BusDashboard from './pages/BusDashboard';
import Sidebar from './components/Sidebar';
import ManageRoute from './pages/ManageRoute';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="flex h-screen bg-brand-gray-50 text-brand-gray-800 font-sans">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<BusDashboard />} />
            <Route path="/routes" element={<ManageRoute />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;