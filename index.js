const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.set('views', 'Views');
app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(
    session({
        secret: 'hotel-management-secret',
        resave: false,
        saveUninitialized: false,
    })
);

// Load data from JSON
const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users.json')));
const rooms = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'rooms.json')));

// Routes
app.get('/', (req, res) => {
    res.render('home', { error: null });
});

app.post('/', (req, res) => {
    const { username, password } = req.body;

    // Validate user
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Save user data in session
        req.session.user = user;

        // Redirect based on role
        if (user.role === 'Receptionist') {
            return res.redirect('/receptionist/dashboard');
        } else if (user.role === 'Housekeeping') {
            return res.redirect('/housekeeping/dashboard');
        }
    } else {
        res.render('home', { error: 'Invalid username or password' });
    }
});

app.get('/receptionist/dashboard', (req, res) => {
    if (req.session.user?.role !== 'Receptionist') {
        return res.redirect('/');
    }

    // Calculate room stats
    const availableRooms = rooms.filter(room => room.status === 'Available').length;
    const occupiedRooms = rooms.filter(room => room.status === 'Occupied').length;
    const needsCleaning = rooms.filter(room => room.status === 'Needs Cleaning').length;

    res.render('receptionist/dashboard', {
        user: req.session.user,
        availableRooms,
        occupiedRooms,
        needsCleaning,
    });
});

// Check-in route
app.post('/receptionist/checkin', (req, res) => {
    if (req.session.user?.role !== 'Receptionist') {
        return res.redirect('/');
    }

    const { roomId, guestName } = req.body;

    // Find the room in the rooms array
    const room = rooms.find(r => r.id === parseInt(roomId));

    if (room && room.status === 'Available') {
        // Update room status
        room.status = 'Occupied';
        room.guestName = guestName; // Optionally store guest name

        // Save the updated rooms to JSON
        fs.writeFileSync(
            path.join(__dirname, 'data', 'rooms.json'),
            JSON.stringify(rooms, null, 2)
        );

        res.redirect('/receptionist/dashboard');
    } else {
        res.render('receptionist/dashboard', {
            user: req.session.user,
            error: 'Room is not available for check-in.',
        });
    }
});

// Add cleaning request route
app.post('/receptionist/cleaning', (req, res) => {
    if (req.session.user?.role !== 'Receptionist') {
        return res.redirect('/');
    }

    const { roomId } = req.body;

    // Find the room in the rooms array
    const room = rooms.find(r => r.id === parseInt(roomId));

    if (room && room.status === 'Occupied') {
        // Update room status to "Needs Cleaning"
        room.status = 'Needs Cleaning';

        // Save the updated rooms to JSON
        fs.writeFileSync(
            path.join(__dirname, 'data', 'rooms.json'),
            JSON.stringify(rooms, null, 2)
        );

        res.redirect('/receptionist/dashboard');
    } else {
        res.render('receptionist/dashboard', {
            user: req.session.user,
            error: 'Room is not occupied or invalid.',
        });
    }
});

// Housekeeping dashboard route
app.get('/housekeeping/dashboard', (req, res) => {
    if (req.session.user?.role !== 'Housekeeping') {
        return res.redirect('/');
    }

    const cleaningTasks = rooms.filter(room => room.status === 'Needs Cleaning');
    res.render('housekeeping/dashboard', { user: req.session.user, cleaningTasks });
});

// Update room status route
app.post('/housekeeping/update-status', (req, res) => {
    if (req.session.user?.role !== 'Housekeeping') {
        return res.redirect('/');
    }

    const { roomNumber, status } = req.body;

    // Find the room in the rooms array
    const room = rooms.find(r => r.id === parseInt(roomNumber));

    if (room) {
        // Update room status
        room.status = status;

        // Save the updated rooms to JSON
        fs.writeFileSync(
            path.join(__dirname, 'data', 'rooms.json'),
            JSON.stringify(rooms, null, 2)
        );

        res.redirect('/housekeeping/dashboard');
    } else {
        res.render('housekeeping/dashboard', {
            user: req.session.user,
            error: `Room ${roomNumber} not found.`,
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
