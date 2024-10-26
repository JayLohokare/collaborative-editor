const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const DeltaUtils = require('./deltaUtils');

// Firebase Admin Setup
process.env.GOOGLE_APPLICATION_CREDENTIALS = './key.json';
const admin = require("firebase-admin");
const serviceAccount = require("./key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// JWT middleware
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).send('Access denied');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userDoc = await db.collection('users').doc(decoded.userId).get();
    
    if (!userDoc.exists) {
      return res.status(401).send('User not found');
    }

    req.user = { id: userDoc.id, ...userDoc.data() };
    next();
  } catch (error) {
    res.status(401).send('Invalid token');
  }
};


// Auth endpoints
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const userQuery = await db.collection('users').where('email', '==', email).get();
    if (!userQuery.empty) {
      return res.status(400).send('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userRef = await db.collection('users').add({
      email,
      password: hashedPassword,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Generate token
    const token = jwt.sign(
      { userId: userRef.id },
      process.env.JWT_SECRET || 'your-secret-key'
    );

    res.status(201).json({
      user: { id: userRef.id, email, name },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const userQuery = await db.collection('users').where('email', '==', email).get();
    if (userQuery.empty) {
      return res.status(401).send('Invalid credentials');
    }

    const userDoc = userQuery.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).send('Invalid credentials');
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key'
    );

    // Remove password from response
    delete user.password;
    res.json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/auth/me", authenticateToken, async (req, res) => {
  try {
    // req.user is already set by authenticateToken middleware
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) {
      return res.status(404).send('User not found');
    }
    
    const userData = userDoc.data();
    delete userData.password; // Don't send password back
    
    res.json({ ...userData, id: userDoc.id });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

// Document endpoints
app.post("/documents", authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    const documentData = {
      title,
      content: '',
      owner: req.user.id,
      collaborators: [req.user.email],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      currentVersion: 0,
      deltas: [],
    };

    const docRef = await db.collection('documents').add(documentData);
    res.status(201).json({ id: docRef.id, ...documentData });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/documents", authenticateToken, async (req, res) => {
  try {
    const documentsRef = db.collection('documents');
    const allDocumentsSnapshot = await documentsRef
      .where('collaborators', 'array-contains', req.user.email)
      .get();

    const documents = [];
    for (const doc of allDocumentsSnapshot.docs) {
      const document = { id: doc.id, ...doc.data() };
      
      // Get user details for collaborators
      const collaborators = await Promise.all(
        document.collaborators.map(async (userId) => {
          const userDoc = await db.collection('users').doc(userId).get();
          return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
        })
      );

      document.collaborators = collaborators.filter(c => c !== null);
      documents.push(document);
    }

    res.json(documents);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/documents/:id", authenticateToken, async (req, res) => {
  try {
    const docRef = await db.collection('documents').doc(req.params.id).get();
    
    if (!docRef.exists) {
      return res.status(404).send('Document not found');
    }

    const document = { id: docRef.id, ...docRef.data() };
    
    // Check if user has access

    if (!document.collaborators?.includes(req.user.email)) {
      return res.status(403).send('Access denied');
    }

    // Get collaborator details
    const collaborators = await Promise.all(
      document.collaborators.map(async (userId) => {
        const userDoc = await db.collection('users').doc(userId).get();
        return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
      })
    );

    // Calculate current content from deltas
    let content = document.baseContent;
    for (const delta of document.deltas) {
      content = DeltaUtils.applyDelta(content, delta.operations);
    }
    document.content = content; // Add compiled content
    delete document.baseContent; // Don't send base content

    res.json(document);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});



// Update the PUT endpoint to use the fixed DeltaUtils
app.put("/documents/:id", authenticateToken, async (req, res) => {
  try {
    const { content, baseVersion, selection } = req.body;
    
    // Validate input
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    const docRef = db.collection('documents').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send('Document not found');
    }

    const document = doc.data();
    if (!document.collaborators?.includes(req.user.email)) {
      return res.status(403).send('Access denied');
    }

    if (baseVersion !== undefined && document.currentVersion !== baseVersion) {
      return res.status(409).json({
        error: 'Version conflict',
        currentVersion: document.currentVersion,
        serverContent: document.content,
        lastEditedBy: document.lastEditedBy
      });
    }

    // Calculate the current content at current version
    let currentContent = document.baseContent || '';
    if (Array.isArray(document.deltas)) {
      for (const delta of document.deltas) {
        currentContent = DeltaUtils.applyDelta(currentContent, delta.operations);
      }
    }

    // Create new delta with proper error handling
    try {
      const newDelta = {
        operations: DeltaUtils.createDelta(
          currentContent,
          content,
          selection?.start ?? 0,
          selection?.end ?? 0
        ),
        author: req.user.email,
        timestamp: new Date().toISOString(),
        version: document.currentVersion + 1
      };

      // Only save if there are actual changes
      if (newDelta.operations.length > 0) {
        await docRef.update({
          deltas: admin.firestore.FieldValue.arrayUnion(newDelta),
          currentVersion: newDelta.version,
          lastEditedBy: req.user.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Broadcast the delta through Socket.IO
        io.to(req.params.id).emit('document-delta', {
          delta: newDelta,
          userId: req.user.id
        });
      }

      const updatedDoc = await docRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (deltaError) {
      console.error('Delta creation error:', deltaError);
      return res.status(400).json({ error: 'Invalid delta operation' });
    }
  } catch (error) {
    console.error('Document update error:', error);
    res.status(500).send("Internal server error");
  }
});

app.post("/documents/:id/collaborators", authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const docRef = db.collection('documents').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send('Document not found');
    }

    const document = doc.data();
    if (document.owner !== req.user.id) {
      return res.status(403).send('Only owner can add collaborators');
    }

    // Find user by email
    const userQuery = await db.collection('users').where('email', '==', email).get();
    if (userQuery.empty) {
      return res.status(404).send('User not found');
    }

    const updatedCollaborators = document.collaborators || [];

    if (!document.collaborators.includes(email)) {
      updatedCollaborators.push(email);
      await docRef.update({
        collaborators: updatedCollaborators
      });
    }

    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

// Socket.IO handler
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const userDoc = await db.collection('users').doc(decoded.userId).get();
    if (!userDoc.exists) {
      return next(new Error('User not found'));
    }

    socket.userId = decoded.userId;
    socket.userEmail = userDoc.data().email;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  socket.on('join-document', async (documentId) => {
    try {
      // Get document reference from Firestore
      const documentRef = db.collection('documents').doc(documentId);
      const documentSnapshot = await documentRef.get();

      if (!documentSnapshot.exists) {
        console.error('Document not found:', documentId);
        return;
      }
      
      const documentData = documentSnapshot.data();
  
      if (documentData.collaborators.includes(socket.userEmail)) {
        socket.join(documentId);
        console.log(`User ${socket.userId} joined document ${documentId}`);

        // Optional: Notify other users in the room
        socket.to(documentId).emit('user-joined', {
          userId: socket.userId,
          timestamp: Date.now()
        });
      } else {
        console.error('User not authorized to join document:', socket.userEmail, documentData.collaborators[0]);
      }
    } catch (error) {
      console.error('Error joining document:', error);
    }
  });

  socket.on('content-delta', async ({ documentId, delta, baseVersion }) => {
    try {
      // Broadcast the delta to all other clients in the document room
      socket.to(documentId).emit('content-delta', {
        delta,
        userId: socket.userId,
        baseVersion,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error broadcasting delta:', error);
    }
  });

  socket.on('content-update', ({ documentId, content, userId }) => {
    socket.to(documentId).emit('content-update', {
      content,
      userId,
      timestamp: Date.now()
    });
  });

  socket.on('document-change', async (data) => {
    try {
      const { documentId, content, userId } = data;
      socket.to(documentId).emit('document-updated', { content, userId });
    } catch (error) {
      console.error('Error broadcasting change:', error);
    }
  });

  socket.on('cursor-move', ({ documentId, position, userId }) => {
    socket.to(documentId).emit('cursor-move', {
      position,
      userId,
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});


// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});