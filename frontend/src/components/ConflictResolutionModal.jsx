import React, { useState } from 'react';
import { ArrowLeftRight, Check, X, AlertTriangle } from 'lucide-react';

const ConflictResolutionModal = ({ 
  localChanges, 
  serverChanges, 
  onResolve, 
  onCancel,
  conflictingUser 
}) => {
  const [selectedVersion, setSelectedVersion] = useState('none');
  const [mergedContent, setMergedContent] = useState(serverChanges.content);
  
  const handleResolve = () => {
    if (selectedVersion === 'merge') {
      onResolve(mergedContent);
    } else if (selectedVersion === 'local') {
      onResolve(localChanges.content);
    } else if (selectedVersion === 'server') {
      onResolve(serverChanges.content);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Resolve Conflicts</h2>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">{conflictingUser}</span> has made changes to this document. 
              Please resolve the conflicts before continuing.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Local Changes */}
            <div 
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedVersion === 'local' ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedVersion('local')}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Your Changes</h3>
                {selectedVersion === 'local' && (
                  <Check className="w-5 h-5 text-blue-500" />
                )}
              </div>
              <div className="h-64 overflow-y-auto bg-gray-50 p-3 rounded">
                <pre className="whitespace-pre-wrap">{localChanges.content}</pre>
              </div>
            </div>

            {/* Server Changes */}
            <div 
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedVersion === 'server' ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedVersion('server')}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Their Changes</h3>
                {selectedVersion === 'server' && (
                  <Check className="w-5 h-5 text-blue-500" />
                )}
              </div>
              <div className="h-64 overflow-y-auto bg-gray-50 p-3 rounded">
                <pre className="whitespace-pre-wrap">{serverChanges.content}</pre>
              </div>
            </div>
          </div>

          {/* Merged View */}
          <div 
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedVersion === 'merge' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedVersion('merge')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <ArrowLeftRight className="w-5 h-5" />
                <h3 className="font-semibold">Merge Changes</h3>
              </div>
              {selectedVersion === 'merge' && (
                <Check className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <textarea
              value={mergedContent}
              onChange={(e) => setMergedContent(e.target.value)}
              className="w-full h-48 p-3 bg-gray-50 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={selectedVersion === 'none'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resolve Conflict
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;