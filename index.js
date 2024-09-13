const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const admin = require('firebase-admin');
const session = require('express-session');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./key.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session middleware
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
}));

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    res.redirect('/signin');
  }
}

// Routes
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/signin', (req, res) => {
  res.render('signin');
});

app.get('/profile', (req, res) => {
  res.render('profile');
});

app.get('/workshop', async (req, res) => {
  try {
    const snapshot = await db.collection('Workshops').orderBy('createdAt', 'desc').get();
    const workshops = snapshot.docs.map(doc => doc.data());
    res.render('workshop', { workshops });
  } catch (error) {
    console.error('Failed to load workshops:', error);
    res.status(500).send('Failed to load workshops');
  }
});

app.get('/projects', async (req, res) => {
  try {
    const snapshot = await db.collection('Projects').orderBy('createdAt', 'desc').get();
    const projects = snapshot.docs.map(doc => doc.data());
    res.render('projects', { projects });
  } catch (error) {
    console.error('Failed to load projects:', error);
    res.status(500).send('Failed to load projects');
  }
});

app.get('/skillshare', (req, res) => {
  res.render('skillshare');
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    await admin.auth().getUserByEmail(email);
    return res.status(400).send('Email already exists');
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      return res.status(400).send(error.message);
    }
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    const passwordHash = await bcrypt.hash(password, 10);

    await db.collection('Registered_Data').doc(userRecord.uid).set({
      name,
      email,
      passwordHash
    });

    req.session.user = {
      uid: userRecord.uid,
      name: userRecord.displayName,
      email: userRecord.email,
    };

    res.redirect('/profile');
  } catch (error) {
    console.error('Failed to sign up:', error);
    res.status(400).send(error.message);
  }
});

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRecord = await admin.auth().getUserByEmail(email);

    const userDoc = await db.collection('Registered_Data').doc(userRecord.uid).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const validPassword = await bcrypt.compare(password, userData.passwordHash);
    if (!validPassword) {
      return res.status(400).send('Invalid credentials');
    }

    req.session.user = {
      uid: userRecord.uid,
      name: userRecord.displayName,
      email: userRecord.email,
    };

    res.redirect('/profile');
  } catch (error) {
    console.error('Failed to sign in:', error);
    res.status(400).send(error.message);
  }
});

app.post('/save-workshop', isAuthenticated, async (req, res) => {
  const { title, description, date, location } = req.body;
  const userId = req.session.user.uid;

  try {
    const workshopRef = db.collection('Workshops').doc();
    await workshopRef.set({
      userId,
      title,
      description,
      date,
      location,
      createdAt: new Date(),
    });
    res.redirect('/workshop');
  } catch (error) {
    console.error('Failed to save workshop:', error);
    res.status(500).send('Failed to save workshop');
  }
});

app.post('/save-project', isAuthenticated, async (req, res) => {
  const { title, description, date, location } = req.body;
  const userId = req.session.user.uid;

  console.log('Saving project for user ID:', userId); // Debugging line

  try {
    const projectRef = db.collection('Projects').doc();
    await projectRef.set({
      userId,
      title,
      description,
      date,
      location,
      createdAt: new Date(),
    });
    res.redirect('/projects');
  } catch (error) {
    console.error('Failed to save project:', error);
    res.status(500).send('Failed to save project');
  }
});

// Test Firestore connectivity
app.get('/test-firestore', async (req, res) => {
  try {
    await db.collection('TestCollection').doc().set({
      testField: 'testValue',
      createdAt: new Date(),
    });
    res.send('Test write successful');
  } catch (error) {
    console.error('Firestore write error:', error);
    res.status(500).send('Firestore write failed');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
