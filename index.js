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



app.get('/receptionist/dashboard', (request, response) =>{
    response.render('receptionist/dashboard');
});


app.get('/receptionist/assignrooms', (request, response) =>{
    response.render('receptionist/assignrooms');
});

app.get('/receptionist/checkin', (request, response) =>{
    response.render('receptionist/checkin');
});

app.get('/receptionist/checkout', (request, response) =>{
    response.render('receptionist/checkout');
});

app.get('/receptionist/rooms', (request, response) =>{
    response.render('receptionist/rooms');
});

app.get('/receptionist/roomstatus', (request, response) =>{
    response.render('receptionist/roomstatus');
});

app.get('/receptionist/specialrequest', (request, response) =>{
    response.render('receptionist/specialrequest');
});

app.get('/receptionist/booking', (request, response) =>{
    response.render('receptionist/booking');
});




// Server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
