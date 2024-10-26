import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/api';

export const fetchDocuments = createAsyncThunk(
  'documents/fetchAll',
  async () => await apiService.getDocuments()
);

export const fetchDocument = createAsyncThunk(
  'documents/fetchOne',
  async (id) => await apiService.getDocument(id)
);

export const createDocument = createAsyncThunk(
  'documents/create',
  async (data) => await apiService.createDocument(data)
);

export const updateDocument = createAsyncThunk(
    'documents/update',
    async ({ id, data }, { rejectWithValue }) => {
      try {
        const response = await apiService.updateDocument(id, data);
        return response;
      } catch (error) {
        if (error.response?.status === 409) {
          return rejectWithValue({
            status: 409,
            serverContent: error.response.data.serverContent,
            currentVersion: error.response.data.currentVersion,
            lastEditedBy: error.response.data.lastEditedBy
          });
        }
        throw error;
      }
    }
  );

export const addCollaborator = createAsyncThunk(
  'documents/addCollaborator',
  async ({ documentId, email }, { rejectWithValue }) => {
    try {
      const response = await apiService.addCollaborator(documentId, email);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || 'Failed to add collaborator'
      );
    }
  }
);

const documentSlice = createSlice({
  name: 'documents',
  initialState: {
    documents: [],
    currentDocument: null,
    loading: false,
    error: null,
    collaboratorStatus: {
      loading: false,
      error: null
    },
    pendingDeltas: [] // Track deltas that haven't been saved yet
  },
  reducers: {
    setCurrentDocument: (state, action) => {
      state.currentDocument = action.payload;
    },
    addPendingDelta: (state, action) => {
        state.pendingDeltas.push(action.payload);
    },
    clearPendingDeltas: (state) => {
        state.pendingDeltas = [];
    },
    applyDelta: (state, action) => {
        if (state.currentDocument) {
            state.currentDocument.deltas.push(action.payload);
            state.currentDocument.currentVersion = action.payload.version;
        }
    },
    clearCollaboratorError: (state) => {
      state.collaboratorStatus.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all documents
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = action.payload;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch single document
      .addCase(fetchDocument.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDocument = action.payload;
      })
      .addCase(fetchDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create document
      .addCase(createDocument.fulfilled, (state, action) => {
        state.documents.push(action.payload);
      })
      // Update document
      .addCase(updateDocument.fulfilled, (state, action) => {
        state.currentDocument = action.payload;
        const index = state.documents.findIndex(doc => doc.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      })
      // Add collaborator
      .addCase(addCollaborator.pending, (state) => {
        state.collaboratorStatus.loading = true;
        state.collaboratorStatus.error = null;
      })
      .addCase(addCollaborator.fulfilled, (state, action) => {
        state.collaboratorStatus.loading = false;
        state.currentDocument = action.payload;
        const index = state.documents.findIndex(doc => doc.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      })
      .addCase(addCollaborator.rejected, (state, action) => {
        state.collaboratorStatus.loading = false;
        state.collaboratorStatus.error = action.payload;
      });
  },
});


export const { 
    setCurrentDocument, 
    clearCollaboratorError,
    addPendingDelta,
    clearPendingDeltas,
    applyDelta 
  } = documentSlice.actions;

// Selectors
export const selectCollaboratorStatus = (state) => state.documents.collaboratorStatus;
export const selectCurrentDocument = (state) => state.documents.currentDocument;
export const selectDocuments = (state) => state.documents.documents;

export default documentSlice.reducer;