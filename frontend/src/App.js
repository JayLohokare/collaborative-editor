import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import Navbar from './components/Navbar';
import Editor from './components/Editor';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import DocumentList from './components/DocumentList';
import ProtectedRoute from './components/auth/ProtectedRoute';

const App = () => {
  return (
    <Provider store={store}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/documents" 
                element={
                  <ProtectedRoute>
                    <DocumentList />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/documents/:id" 
                element={
                  <ProtectedRoute>
                    <Editor />
                  </ProtectedRoute>
                } 
              />
              <Route path="/" element={<Navigate to="/documents" replace />} />
            </Routes>
          </div>
        </div>
      </Router>
    </Provider>
  );
};

export default App;