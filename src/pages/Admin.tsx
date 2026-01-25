
import React from 'react';
import AdminDashboard from '../components/admin/AdminDashboard';
import ProtectedRoute from '../components/admin/ProtectedRoute';


const Admin = () => {
  return (
    <ProtectedRoute>
      <AdminDashboard />
    </ProtectedRoute>
  );
};

export default Admin;
