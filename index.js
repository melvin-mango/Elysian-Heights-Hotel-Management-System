const express = require('express');
const app = express();
const port = 3000;

app.set('Views', 'Views');
app.set('view engine', 'hbs');
app.use(express.static('public'));


app.get('/', function (request, response){
    response.render('home');
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


app.listen(port);
console.log('server is listening on port 3000');