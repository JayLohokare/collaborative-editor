import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { 
  fetchDocument, 
  updateDocument,
  addPendingDelta,
  clearPendingDeltas,
  applyDelta 
} from '../store/slices/documentSlice';
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import VersionHistory from './VersionHistory';
import CollaboratorsList from './CollaboratorsList';
import ConflictResolutionModal from './ConflictResolutionModal';
import collaborationService from '../services/collaborationService';

const CURSOR_UPDATE_INTERVAL = 5;
const SAVE_INTERVAL = 2000;
const SIGNIFICANT_CHANGE_THRESHOLD = 10;
const RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_DELAY = 2000;

const Editor = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const socketRef = useRef();
  const editorRef = useRef(null);
  
  // State management
  const [connected, setConnected] = useState(false);
  const [localContent, setLocalContent] = useState('');
  const [collaboratorCursors, setCollaboratorCursors] = useState({});
  const [pendingChanges, setPendingChanges] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [activeUsers, setActiveUsers] = useState(new Set());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Refs for tracking content and versions
  const lastSavedContent = useRef('');
  const lastBroadcastContent = useRef('');
  const baseVersion = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  
  const { currentDocument, loading, error } = useSelector((state) => state.documents);
  const { user, token } = useSelector((state) => state.auth);

  // Utility functions
  const hasSignificantChanges = useCallback((newContent) => {
    const changes = Math.abs(newContent.length - lastSavedContent.current.length);
    return changes >= SIGNIFICANT_CHANGE_THRESHOLD;
  }, []);

  // Initialize collaboration service
  useEffect(() => {
    if (socketRef.current && currentDocument) {
      collaborationService.initialize(socketRef.current, currentDocument.content, {
        onContentChange: (newContent, metadata, source) => {
          if (source !== user.id) {
            if (pendingChanges) {
              setConflictData({
                localChanges: {
                  content: localContent,
                  version: baseVersion.current
                },
                serverChanges: {
                  content: newContent,
                  version: metadata.version
                },
                conflictingUser: source
              });
              setShowConflict(true);
            } else {
              setLocalContent(newContent);
              dispatch(applyDelta(metadata.delta));
              baseVersion.current = metadata.version;
              lastSavedContent.current = newContent;
              lastBroadcastContent.current = newContent;
            }
          }
        },
        onError: (error) => {
          console.error('Collaboration error:', error);
        }
      });

      return () => {
        collaborationService.destroy();
      };
    }
  }, [socketRef.current, currentDocument, user?.id, pendingChanges, localContent, dispatch]);

  // Handle conflict resolution
  const handleConflictResolution = async (resolvedContent) => {
    setShowConflict(false);
    setLocalContent(resolvedContent);
    
    try {
      const selection = {
        start: editorRef.current?.selectionStart || 0,
        end: editorRef.current?.selectionEnd || 0
      };

      const delta = collaborationService.createDelta(resolvedContent, selection);
      const result = await dispatch(updateDocument({ 
        id, 
        data: { 
          content: resolvedContent,
          delta,
          baseVersion: conflictData.serverChanges.version,
          selection
        }
      })).unwrap();
      
      lastSavedContent.current = resolvedContent;
      lastBroadcastContent.current = resolvedContent;
      baseVersion.current = result.currentVersion;
      dispatch(clearPendingDeltas());
      setPendingChanges(false);

      if (connected && socketRef.current) {
        socketRef.current.emit('content-delta', {
          documentId: id,
          delta,
          userId: user.id, 
          baseVersion: result.currentVersion
        });
      }
    } catch (err) {
      console.error('Failed to save resolved changes:', err);
    }
  };

  // Throttled cursor position broadcast
  const broadcastCursorPosition = useCallback(
    throttle((position) => {
      if (connected && socketRef.current) {
        socketRef.current.emit('cursor-move', {
          documentId: id,
          userId: user.id,
          position,
          timestamp: Date.now()
        });
      }
    }, CURSOR_UPDATE_INTERVAL),
    [connected, id, user?.id]
  );

  // Save changes with delta
  const saveChanges = useCallback(
    debounce(async (content) => {
      if (!hasSignificantChanges(content)) {
        setPendingChanges(false);
        return;
      }

      try {
        const selection = {
          start: editorRef.current?.selectionStart || 0,
          end: editorRef.current?.selectionEnd || 0
        };

        const result = await dispatch(updateDocument({ 
          id, 
          data: { 
            content,
            delta: collaborationService.createDelta(content, selection),
            baseVersion: collaborationService.getVersion(),
            selection
          }
        })).unwrap();
        
        lastSavedContent.current = content;
        baseVersion.current = result.currentVersion;
        dispatch(clearPendingDeltas());
        setPendingChanges(false);
      } catch (err) {
        if (err.status === 409) {
          setConflictData({
            localChanges: {
              content: localContent,
              version: baseVersion.current
            },
            serverChanges: {
              content: err.serverContent,
              version: err.currentVersion
            },
            conflictingUser: err.lastEditedBy
          });
          setShowConflict(true);
        } else {
          console.error('Failed to save changes:', err);
        }
      }
    }, SAVE_INTERVAL),
    [dispatch, id, hasSignificantChanges, localContent, user?.id]
  );

  // Socket initialization
  useEffect(() => {
    if (!token || !currentDocument) return;

    socketRef.current = io(process.env.REACT_APP_API_URL, {
      auth: { token },
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY,
      timeout: 10000
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      socketRef.current.emit('join-document', id);
    });

    socketRef.current.on('user-presence', ({ userId, status }) => {
      setActiveUsers(prev => {
        const newSet = new Set(prev);
        status === 'active' ? newSet.add(userId) : newSet.delete(userId);
        return newSet;
      });
    });

    socketRef.current.on('cursor-move', ({ userId, position, timestamp }) => {
      if (userId !== user.id) {
        setCollaboratorCursors(prev => ({
          ...prev,
          [userId]: { position, timestamp }
        }));
      }
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
    });

    socketRef.current.on('user-left', ({ userId, timestamp }) => {
      setCollaboratorCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
      
      setActiveUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });
    
    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setConnected(false);
    });

    return () => socketRef.current?.disconnect();
  }, [token, currentDocument, id, user?.id]);

  // Initial document fetch
  useEffect(() => {
    if (id) {
      dispatch(fetchDocument(id));
    }
  }, [id, dispatch]);

  // Initial content setup
  useEffect(() => {
    if (currentDocument) {
      const content = currentDocument.content || '';
      setLocalContent(content);
      lastSavedContent.current = content;
      lastBroadcastContent.current = content;
      baseVersion.current = currentDocument.currentVersion || 0;
    }
  }, [currentDocument]);

  // Offline status handling
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Event handlers
  const handleSelectionChange = () => {
    if (editorRef.current) {
      const { selectionStart, selectionEnd } = editorRef.current;
      selectionRef.current = { start: selectionStart, end: selectionEnd };
      broadcastCursorPosition({ start: selectionStart, end: selectionEnd });
    }
  };

  const handleContentChange = async (e) => {
    if (!editorRef.current || isTransforming) return;
    
    const newContent = e.target.value;
    const selection = {
      start: editorRef.current.selectionStart,
      end: editorRef.current.selectionEnd
    };
    
    try {
      setIsTransforming(true);
      
      const delta = collaborationService.createDelta(newContent, selection);
      setLocalContent(newContent);
      setPendingChanges(true);
      
      if (connected && socketRef.current) {
        socketRef.current.emit('content-delta', {
          documentId: id,
          delta,
          userId: user.id,
          baseVersion: collaborationService.getVersion()
        });
      }
      
      dispatch(addPendingDelta(delta));
      saveChanges(newContent);
    } finally {
      setIsTransforming(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-12 gap-4 h-screen p-4">
      <div className="col-span-9 space-y-4">
        {/* Status indicators */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${
              connected ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-600' : 'bg-red-600'
              }`} />
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {isOffline && (
              <div className="text-yellow-600">
                Offline Mode
              </div>
            )}
            {pendingChanges && (
              <div className="text-gray-600">
                Unsaved changes...
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="relative bg-white rounded-lg shadow-lg p-4">
          <textarea
            ref={editorRef}
            value={localContent}
            onChange={handleContentChange}
            onSelect={handleSelectionChange}
            className="w-full h-[calc(100vh-12rem)] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Collaborator cursors */}
          {Object.entries(collaboratorCursors).map(([userId, data]) => (
            <div
              key={userId}
              className="absolute pointer-events-none bg-yellow-200 opacity-50"
              style={{
                left: `${data.position.start * 8}px`,
                top: `${Math.floor(data.position.start / 80) * 20}px`,
                width: '2px',
                height: '20px'
              }}
            />
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="col-span-3 space-y-4">
        <CollaboratorsList
          documentId={currentDocument?.id}
          collaborators={currentDocument?.collaborators}
          activeCursors={collaboratorCursors}
          activeUsers={activeUsers}
        />
        <VersionHistory 
          versions={currentDocument?.deltas} 
          currentVersion={currentDocument?.currentVersion}
        />
      </div>

      {/* Conflict Resolution Modal */}
      {showConflict && conflictData && (
        <ConflictResolutionModal
          localChanges={conflictData.localChanges}
          serverChanges={conflictData.serverChanges}
          conflictingUser={conflictData.conflictingUser}
          onResolve={handleConflictResolution}
          onCancel={() => setShowConflict(false)}
        />
      )}
    </div>
  );
};

export default Editor;