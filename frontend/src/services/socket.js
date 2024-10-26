import { io } from 'socket.io-client';

export const initializeSocket = (token) => {
  const socket = io(process.env.REACT_APP_WEBSOCKET_URL, {
    auth: {
      token
    }
  });

  return socket;
};