
import React from 'react';
import AdminDashboard from '../components/admin/AdminDashboard';
import ProtectedRoute from '../components/admin/ProtectedRoute';
import { usePageMeta } from '../hooks/usePageMeta';

const Admin = () => {
  usePageMeta({
    title: 'Admin — Pravin Raj Muralitharan',
    description: 'Portfolio administration.',
    robots: 'noindex,nofollow',
  });

  return (
    <ProtectedRoute>
      <AdminDashboard />
    </ProtectedRoute>
  );
};

export default Admin;
