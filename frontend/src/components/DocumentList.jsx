import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchDocuments, createDocument } from '../store/slices/documentSlice';

const DocumentList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { documents, loading, error } = useSelector((state) => state.documents);

  useEffect(() => {
    dispatch(fetchDocuments());
  }, [dispatch]);

  const handleCreateDocument = async () => {
    try {
      const result = await dispatch(createDocument({ title: 'Untitled Document' })).unwrap();
      navigate(`/documents/${result.id}`);
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
        <button
          onClick={handleCreateDocument}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          New Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No documents yet. Create your first document!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              to={`/documents/${doc.id}`}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-medium text-gray-900">{doc.title}</h2>
                <span className="text-xs text-gray-500">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  {doc.collaborators.length} collaborator(s)
                </p>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-1">
                {doc.collaborators.map((collaborator, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {collaborator.email}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentList;