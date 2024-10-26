import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getCurrentUser } from '../../store/slices/authSlice';

const ProtectedRoute = ({ children }) => {
  const dispatch = useDispatch();
  const { user, token, initialized, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token && !user && !initialized && !loading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, user, initialized, loading]);

  if (!initialized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;