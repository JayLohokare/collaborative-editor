import { configureStore } from '@reduxjs/toolkit';
import documentReducer from './slices/documentSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    documents: documentReducer,
    auth: authReducer,
  },
});