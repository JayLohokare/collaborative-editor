import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown, ChevronUp, RotateCcw, Eye } from 'lucide-react';

const VersionHistory = ({ versions = [], currentVersion }) => {
  const [expandedVersions, setExpandedVersions] = useState(new Set());
  const users = useSelector((state) => state.documents?.users || {});
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.round((now - date) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} hours ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
    }
  };

  const getChangeDescription = (operations) => {
    if (!operations || operations.length === 0) return 'No changes';
    
    let insertCount = 0;
    let deleteCount = 0;
    
    operations.forEach(op => {
      if (op.insert) insertCount += op.insert.length;
      if (op.delete) deleteCount += op.delete;
    });
    
    const parts = [];
    if (insertCount > 0) parts.push(`added ${insertCount} characters`);
    if (deleteCount > 0) parts.push(`removed ${deleteCount} characters`);
    
    return parts.join(' and ') || 'Modified document';
  };

  const toggleVersion = (version) => {
    setExpandedVersions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(version.version)) {
        newSet.delete(version.version);
      } else {
        newSet.add(version.version);
      }
      return newSet;
    });
  };

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Version History</h3>
      
      <div className="space-y-4">
        {sortedVersions.map((version, index) => {
          const isExpanded = expandedVersions.has(version.version);
          const isCurrent = version.version === currentVersion;
          
          return (
            <div
              key={version.version}
              className={`relative flex flex-col space-y-2 p-3 rounded-lg transition-colors ${
                isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              {/* Timeline connector */}
              {index !== versions.length - 1 && (
                <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-gray-200" />
              )}

              <div className="flex items-start space-x-3">
                {/* Version marker */}
                <div className="relative">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ${
                    isCurrent 
                      ? 'bg-blue-100 ring-blue-50 text-blue-600' 
                      : 'bg-gray-100 ring-white text-gray-600'
                  }`}>
                    <span className="text-sm font-medium">v{version.version}</span>
                  </div>
                </div>

                {/* Version info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {users[version.author]?.email || 'Unknown User'}
                      </span>
                      <span className="text-gray-500 ml-2">
                        {formatTime(version.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleVersion(version)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="mt-1 text-sm text-gray-600">
                    {getChangeDescription(version.operations)}
                  </p>

                  {/* Version actions */}
                  {isExpanded && (
                    <div className="mt-3 flex space-x-4">
                      <button className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                      <button className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800">
                        <RotateCcw className="h-4 w-4" />
                        <span>Restore</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VersionHistory;