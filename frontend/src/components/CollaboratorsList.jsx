import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addCollaborator, selectCollaboratorStatus, clearCollaboratorError } from '../store/slices/documentSlice';
import { User, UserPlus, AlertCircle, Mail, X } from 'lucide-react';

const CollaboratorsList = ({ documentId, collaborators = [], activeCursors = {} }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { loading, error } = useSelector(selectCollaboratorStatus);
  const currentUser = useSelector((state) => state.auth.user);

  useEffect(() => {
    return () => {
      dispatch(clearCollaboratorError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearCollaboratorError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    
    try {
      await dispatch(addCollaborator({ documentId, email })).unwrap();
      setEmail('');
      setShowForm(false);
    } catch (err) {
      // Error is handled by the redux slice
    }
  };

  const getLastActive = (userId) => {
    const cursor = activeCursors[userId];
    if (!cursor?.timestamp) return null;
    
    const diffMinutes = Math.round((Date.now() - cursor.timestamp) / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return `${Math.floor(diffMinutes / 60)}h ago`;
  };

  const getCollaboratorStatus = (collaborator) => {
    if (!collaborator) return 'unknown';
    if (activeCursors[collaborator.id]) return 'active';
    if (collaborator.lastSeen) return 'away';
    return 'offline';
  };

  const statusColors = {
    active: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-300',
    unknown: 'bg-gray-300'
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Collaborators</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm flex-1">{error}</span>
          <button 
            onClick={() => dispatch(clearCollaboratorError())}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add Collaborator Form */}
      {showForm && (
        <form onSubmit={handleAddCollaborator} className="p-3 bg-gray-50 rounded-lg">
          <div className="flex flex-col space-y-2">
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Collaborator's email"
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={`px-4 py-2 rounded-md text-white flex items-center space-x-2 ${
                  loading || !email.trim()
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Add'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Collaborators List */}
      <div className="space-y-1">
        {collaborators.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {collaborators.map((collaborator) => {
              if (!collaborator) return null;
              const status = getCollaboratorStatus(collaborator);
              const isCurrentUser = currentUser?.email === collaborator;
              const lastActive = getLastActive(collaborator.id);
              
              return (
                <li 
                  key={collaborator.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-full ${
                        isCurrentUser ? 'bg-blue-100' : 'bg-gray-100'
                      } flex items-center justify-center`}>
                        <User className={`w-4 h-4 ${
                          isCurrentUser ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        statusColors[status]
                      }`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {collaborator.split('@')[0]}
                        {isCurrentUser && ' (you)'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {status === 'active' ? 'Active now' : lastActive || collaborator}
                      </span>
                    </div>
                  </div>
                  
                  {status === 'active' && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-500">Editing</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No collaborators yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Add people to collaborate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollaboratorsList;