const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore
const firestore = new Firestore({
  projectId: 'sully-db',
  // Make sure to set up authentication, either through environment variables or a key file
});
const sessionsCollection = firestore.collection('sessions');
