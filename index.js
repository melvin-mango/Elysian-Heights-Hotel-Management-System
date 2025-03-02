const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const hbs = require("hbs");

const app = express();
const port = 3000;

// Middleware
app.set('views', 'Views');
app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());

app.use('/data', express.static(path.join(__dirname, 'data')));

app.use(express.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));



// Load data from JSON
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const rooms = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'rooms.json')));
const roomsFilePath = path.join(__dirname, 'data', 'rooms.json');



const findUser = (username, password) => {
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

    for (const role in usersData) {
        const user = usersData[role].find(u => u.username === username && u.password === password);
        if (user) {
            return { ...user, role };
        }
    }
    return null;
};

// Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync('data/users.json'));

    let foundUser = null;
    let role = null;

    for (const [key, userList] of Object.entries(users)) {
        const user = userList.find(u => u.username === username && u.password === password);
        if (user) {
            foundUser = user;
            role = key; // "admin", "receptionists", or "housekeeping"
            break;
        }
    }

    if (!foundUser) {
        return res.render('login', { error: 'Invalid credentials' });
    }

    req.session.user = { username, role }; // Store user in session

    if (role === 'admin') {
        return res.redirect('/admin/dashboard');
    } else if (role === 'receptionists') {
        return res.redirect('/receptionist/dashboard');
    } else if (role === 'housekeeping') {
        return res.redirect('/housekeeping/dashboard');
    }
});

// Get logged-in user info
app.get('/current-user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'User not logged in' });
    }
});

function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/'); // Redirect to login if not authenticated
    }
    next();
}

function isAuthorized(role) {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.role !== role) {
            return res.status(403).send('Access Denied'); // Restrict access
        }
        next();
    };
}



hbs.registerHelper("eq", function (a, b) {
    return a === b;
});


app.get("/api/room-stats", (req, res) => {
    const rooms = JSON.parse(fs.readFileSync("data/rooms.json")).rooms;

    const stats = {
        occupied: rooms.filter(room => room.occupationStatus === "occupied").length,
        vacant: rooms.filter(room => room.occupationStatus === "vacant").length,
        clean: rooms.filter(room => room.cleanStatus === "clean").length,
        unclean: rooms.filter(room => room.cleanStatus === "unclean").length,
        pending: rooms.filter(room => room.cleanStatus === "pending").length
    };

    res.json(stats);
});


// Routes
app.get('/', (req, res) => {
    res.render('login', { error: null });
});


const messagesFile = "data/messages.json";

// Get messages
app.get("/messages", (req, res) => {
    fs.readFile(messagesFile, "utf8", (err, data) => {
        if (err) return res.status(500).json({ error: "Error reading messages" });
        res.json(JSON.parse(data));
    });
});

// Send message
app.post("/messages", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "User not logged in" });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message cannot be empty" });
    }

    fs.readFile(messagesFile, "utf8", (err, data) => {
        if (err) return res.status(500).json({ error: "Error reading messages" });

        const messages = JSON.parse(data);
        const newMessage = {
            username: req.session.user.username,
            message,
            timestamp: new Date().toISOString()
        };

        messages.push(newMessage);

        fs.writeFile(messagesFile, JSON.stringify(messages, null, 2), (err) => {
            if (err) return res.status(500).json({ error: "Error saving message" });
            res.json({ success: true, message: "Message sent" });
        });
    });
});






app.get('/receptionist/dashboard', isAuthenticated, isAuthorized('receptionists'), (req, res) => {
    const availableRooms = rooms.rooms.filter(room => room.occupationStatus === "vacant").length;
    const occupiedRooms = rooms.rooms.filter(room => room.occupationStatus === "occupied").length;
    const needsCleaning = rooms.rooms.filter(room => room.cleanStatus === "unclean" || room.cleanStatus === "pending").length;

    res.render('receptionist/dashboard', {
        availableRooms,
        occupiedRooms,
        needsCleaning
    });
});

app.get("/receptionist/assignrooms", isAuthenticated, isAuthorized('receptionists'), (req, res) => {
    fs.readFile(path.join(__dirname, "data", "guests.json"), "utf8", (err, guestData) => {
        if (err) return res.status(500).send("Error reading guest data.");

        fs.readFile(path.join(__dirname, "data", "rooms.json"), "utf8", (err, roomData) => {
            if (err) return res.status(500).send("Error reading room data.");

            try {
                let guests = JSON.parse(guestData);
                let rooms = JSON.parse(roomData).rooms; // Access the correct array

                if (!Array.isArray(guests) || !Array.isArray(rooms)) {
                    throw new Error("JSON files must contain an array.");
                }

                // Get guests without assigned rooms
                const guestsWithoutRooms = guests.filter(guest => !guest.roomNumber);

                // Get assigned room numbers
                const assignedRooms = guests
                    .filter(guest => guest.roomNumber)
                    .map(guest => guest.roomNumber);

                // Get available rooms (rooms not in assignedRooms)
                const availableRooms = rooms.filter(room => !assignedRooms.includes(room.roomNumber));

                res.render("receptionist/assignrooms", {
                    checkedInGuests: guestsWithoutRooms,
                    availableRooms: availableRooms.map(room => room.roomNumber)
                });

            } catch (error) {
                console.error("JSON Parsing Error:", error.message);
                return res.status(500).send("Invalid data format in JSON files.");
            }
        });
    });
});



app.post("/receptionist/assignrooms", (req, res) => {
    const { email, roomNumber } = req.body;

    if (!email || !roomNumber) {
        return res.status(400).json({ success: false, error: "Invalid request. Missing email or room number." });
    }

    const guestsPath = path.join(__dirname, "data", "guests.json");
    const roomsPath = path.join(__dirname, "data", "rooms.json");

    // Read guest data
    fs.readFile(guestsPath, "utf8", (err, guestData) => {
        if (err) return res.status(500).json({ success: false, error: "Error reading guest data." });

        let guests = JSON.parse(guestData);
        let guest = guests.find(g => g.email.trim().toLowerCase() === email.trim().toLowerCase());

        if (!guest) return res.status(404).json({ success: false, error: "Guest not found." });

        // Assign room and change guest status
        guest.roomNumber = roomNumber;
        guest.occupationStatus = "checked-in";

        // Read room data
        fs.readFile(roomsPath, "utf8", (err, roomData) => {
            if (err) return res.status(500).json({ success: false, error: "Error reading room data." });

            let rooms = JSON.parse(roomData).rooms;
            let room = rooms.find(r => r.roomNumber === roomNumber);

            if (!room) return res.status(404).json({ success: false, error: "Room not found." });

            // Update room status to occupied
            room.occupationStatus = "occupied";

            // Save updated rooms.json
            fs.writeFile(roomsPath, JSON.stringify({ rooms }, null, 2), (err) => {
                if (err) return res.status(500).json({ success: false, error: "Error updating room data." });

                // Save updated guests.json
                fs.writeFile(guestsPath, JSON.stringify(guests, null, 2), (err) => {
                    if (err) return res.status(500).json({ success: false, error: "Error updating guest data." });

                    res.json({ success: true, message: "Room assigned successfully!" });
                });
            });
        });
    });
});


// Route to render check-in details from guests.json
app.get("/receptionist/checkin", isAuthenticated, isAuthorized('receptionists'), (req, res) => {
    fs.readFile(path.join(__dirname, "data", "guests.json"), "utf8", (err, data) => {
        if (err) {
            return res.status(500).send("Error reading guest data.");
        }
        const guests = JSON.parse(data);
        const checkedInGuests = guests.filter(guest => guest.occupationStatus === "checked-in");
        res.render("receptionist/checkin", { checkedInGuests });
    });
});

app.get("/receptionist/checkout" , isAuthenticated, isAuthorized('receptionists'), (req, res) => {
    fs.readFile(path.join(__dirname, "data", "guests.json"), "utf8", (err, data) => {
        if (err) {
            return res.status(500).send("Error reading guest data.");
        }
        const guests = JSON.parse(data);
        res.render("receptionist/checkout", { checkedInGuests: guests });
    });
});


app.post("/receptionist/checkout/:email", (req, res) => {
    fs.readFile(path.join(__dirname, "data", "guests.json"), "utf8", (err, guestData) => {
        if (err) {
            return res.status(500).send("Error reading guest data.");
        }

        let guests = JSON.parse(guestData);
        const email = req.params.email;

        const guestIndex = guests.findIndex(guest => guest.email === email);
        if (guestIndex === -1) {
            return res.status(404).send("Guest not found.");
        }

        const roomNumber = guests[guestIndex].roomNumber; // Get assigned room

        // Update guest details
        guests[guestIndex].occupationStatus = "checked-out";
        guests[guestIndex].roomNumber = null; // Remove assigned room

        // Read and update rooms.json
        fs.readFile(path.join(__dirname, "data", "rooms.json"), "utf8", (err, roomData) => {
            if (err) {
                return res.status(500).send("Error reading room data.");
            }

            let rooms = JSON.parse(roomData);
            const roomIndex = rooms.rooms.findIndex(room => room.roomNumber == roomNumber); // Find room

            if (roomIndex !== -1) {
                rooms.rooms[roomIndex].occupationStatus = "vacant"; // Set room to vacant
            }

            // Write updated guests.json
            fs.writeFile(path.join(__dirname, "data", "guests.json"), JSON.stringify(guests, null, 2), (err) => {
                if (err) {
                    return res.status(500).send("Error updating guest data.");
                }

                // Write updated rooms.json
                fs.writeFile(path.join(__dirname, "data", "rooms.json"), JSON.stringify(rooms, null, 2), (err) => {
                    if (err) {
                        return res.status(500).send("Error updating room data.");
                    }

                    res.redirect("/receptionist/checkout"); // Refresh checkout page
                });
            });
        });
    });
});

app.delete("/receptionist/deleteGuest/:email" , isAuthenticated, isAuthorized('receptionists'),(req, res) => {
    fs.readFile(path.join(__dirname, "data", "guests.json"), "utf8", (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, error: "Error reading guest data." });
        }

        let guests = JSON.parse(data);
        const email = req.params.email;

        const guestIndex = guests.findIndex(guest => guest.email === email);
        if (guestIndex === -1) {
            return res.status(404).json({ success: false, error: "Guest not found." });
        }

        guests.splice(guestIndex, 1); // Remove guest from array

        fs.writeFile(path.join(__dirname, "data", "guests.json"), JSON.stringify(guests, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: "Error updating guest data." });
            }
            res.json({ success: true });
        });
    });
});





app.get("/receptionist/rooms" , isAuthenticated, isAuthorized('receptionists'), (req, res) => {
    fs.readFile(path.join(__dirname, "data", "rooms.json"), "utf8", (err, data) => {
        if (err) {
            return res.status(500).send("Error reading room data.");
        }

        let rooms = JSON.parse(data).rooms; // Extract the array

        res.render("receptionist/rooms", { rooms }); // Pass data to Handlebars
    });
});

app.get("/receptionist/roomstatus" , isAuthenticated, isAuthorized('receptionists'), (req, res) => {
    fs.readFile(path.join(__dirname, "data", "rooms.json"), "utf8", (err, data) => {
        if (err) {
            return res.status(500).send("Error reading room data.");
        }

        let rooms = JSON.parse(data).rooms; // Extract the array

        res.render("receptionist/roomstatus", { rooms }); // Pass data to Handlebars
    });
});


app.get('/receptionist/specialrequest', isAuthenticated, isAuthorized('receptionists'), (request, response) =>{
    response.render('receptionist/specialrequest');
});

app.post('/specialrequest', (req, res) => {
    const requestData = req.body;

    if (!requestData.roomNo || !requestData.description || !requestData.status) {
        return res.status(400).json({ success: false, message: "Missing data" });
    }

    // Read the specialrequest.json file
    fs.readFile(path.join(__dirname, 'data', 'specialrequest.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error reading specialrequest.json' });
        }

        let specialRequests = [];
        if (data) {
            specialRequests = JSON.parse(data);
        }

        // Add the new request to the list
        specialRequests.push(requestData);

        // Write the updated data back to specialrequest.json
        fs.writeFile(path.join(__dirname, 'data', 'specialrequest.json'), JSON.stringify(specialRequests, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error updating specialrequest.json' });
            }
            res.json({ success: true, message: 'Special request submitted successfully!' });
        });
    });
});

app.get('/receptionist/booking' , isAuthenticated, isAuthorized('receptionists'),(request, response) =>{
    response.render('receptionist/booking');
});

const guestsFile = path.join(__dirname, "data", "guests.json");

app.post("/add-guest", (req, res) => {
    fs.readFile(guestsFile, "utf8", (err, data) => {
        if (err && err.code !== "ENOENT") return res.status(500).json({ error: "Server error" });

        let guests = data ? JSON.parse(data) : [];

        const newGuest = {
            guestName: req.body.guestName,
            email: req.body.email,
            checkInDate: req.body.checkInDate,
            checkOutDate: req.body.checkOutDate,
            passportOrId: req.body.passportOrId,
            contact: req.body.contact,
            numberOfAdults: req.body.numberOfAdults,
            numberOfChildren: req.body.numberOfChildren,
            roomNumber: null, // Always null when adding
            occupationStatus: null // Always null when adding
        };

        guests.push(newGuest);

        fs.writeFile(guestsFile, JSON.stringify(guests, null, 2), (err) => {
            if (err) return res.status(500).json({ error: "Failed to save guest" });

            res.status(200).json({ message: "Guest added successfully" });
        });
    });
});

app.get("/rooms.json", (req, res) => {
    const roomsFile = path.join(__dirname, "data", "rooms.json");
    fs.readFile(roomsFile, "utf8", (err, data) => {
        if (err) return res.status(500).json({ error: "Error loading room data" });
        res.json(JSON.parse(data));
    });
});


// Housekeeping --------------------------------------------------------------

app.get('/housekeeping/dashboard', isAuthenticated, isAuthorized('housekeeping'), (req, res) => {
    const availableRooms = rooms.rooms.filter(room => room.occupationStatus === "vacant").length;
    const occupiedRooms = rooms.rooms.filter(room => room.occupationStatus === "occupied").length;
    const needsCleaning = rooms.rooms.filter(room => room.cleanStatus === "unclean" || room.cleanStatus === "pending").length;

    res.render('housekeeping/dashboard', {
        availableRooms,
        occupiedRooms,
        needsCleaning
    });
});



app.get('/housekeeping/clean', isAuthenticated, isAuthorized('housekeeping'), (req, res) => {
    fs.readFile(roomsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading rooms.json:", err);
            return res.status(500).send("Internal Server Error");
        }

        try {
            const roomsData = JSON.parse(data);
            const cleanRooms = roomsData.rooms.filter(room => room.cleanStatus === "clean");

            res.render('housekeeping/clean', { rooms: cleanRooms }); 
        } catch (parseError) {
            console.error("Error parsing rooms.json:", parseError);
            return res.status(500).send("Invalid JSON format");
        }
    });
});

app.get('/housekeeping/unclean', isAuthenticated, isAuthorized('housekeeping'), (req, res) => {
    fs.readFile(roomsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading rooms.json:", err);
            return res.status(500).send("Internal Server Error");
        }

        try {
            const roomsData = JSON.parse(data);
            const cleanRooms = roomsData.rooms.filter(room => room.cleanStatus === "unclean");

            res.render('housekeeping/unclean', { rooms: cleanRooms }); 
        } catch (parseError) {
            console.error("Error parsing rooms.json:", parseError);
            return res.status(500).send("Invalid JSON format");
        }
    });
});

app.get('/housekeeping/pending', isAuthenticated, isAuthorized('housekeeping'), (req, res) => {
    fs.readFile(roomsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading rooms.json:", err);
            return res.status(500).send("Internal Server Error");
        }

        try {
            const roomsData = JSON.parse(data);
            const cleanRooms = roomsData.rooms.filter(room => room.cleanStatus === "pending");

            res.render('housekeeping/pending', { rooms: cleanRooms }); 
        } catch (parseError) {
            console.error("Error parsing rooms.json:", parseError);
            return res.status(500).send("Invalid JSON format");
        }
    });
});


app.post('/update-room-status', (req, res) => {
    const { roomNumber, newStatus } = req.body;

    // Always read the latest rooms.json file
    fs.readFile(roomsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading rooms.json:", err);
            return res.status(500).json({ success: false, message: "Server error" });
        }

        let roomsData;
        try {
            roomsData = JSON.parse(data);
        } catch (parseError) {
            console.error("Error parsing rooms.json:", parseError);
            return res.status(500).json({ success: false, message: "Invalid JSON format" });
        }

        // Find the room and update cleanStatus
        const roomIndex = roomsData.rooms.findIndex(room => room.roomNumber === roomNumber);
        if (roomIndex !== -1) {
            roomsData.rooms[roomIndex].cleanStatus = newStatus;

            // Save the updated data
            fs.writeFile(roomsFilePath, JSON.stringify(roomsData, null, 2), (err) => {
                if (err) {
                    console.error("Error writing to rooms.json:", err);
                    return res.status(500).json({ success: false, message: "Failed to save changes" });
                }
                res.json({ success: true, updatedRoom: roomsData.rooms[roomIndex] });
            });
        } else {
            res.status(404).json({ success: false, message: "Room not found" });
        }
    });
});



const specialRequestFilePath = path.join(__dirname, 'data', 'specialrequest.json');

app.get('/housekeeping/specialrequest',  isAuthenticated, isAuthorized('housekeeping'), (req, res) => {
    fs.readFile(specialRequestFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading specialrequest.json:", err);
            return res.status(500).send("Internal Server Error");
        }

        let rooms = JSON.parse(data);

        // Ensure all room objects use "roomNumber" instead of "roomNo" for consistency
        rooms = rooms.map(room => ({
            roomNumber: room.roomNumber || room.roomNo, // Normalize key names
            description: room.description,
            status: room.status
        }));

        res.render('housekeeping/specialrequest', { rooms });
    });
});

app.post('/update-specialrequest-status', (req, res) => {
    const { roomNumber, newStatus } = req.body;

    fs.readFile(specialRequestFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading specialrequest.json:", err);
            return res.status(500).json({ success: false });
        }

        let rooms = JSON.parse(data);

        // Find the room and update its status
        const roomIndex = rooms.findIndex(room => room.roomNumber === roomNumber || room.roomNo === roomNumber);
        if (roomIndex !== -1) {
            rooms[roomIndex].status = newStatus;

            // Write the updated data back to the file
            fs.writeFile(specialRequestFilePath, JSON.stringify(rooms, null, 2), (err) => {
                if (err) {
                    console.error("Error updating room status:", err);
                    return res.status(500).json({ success: false });
                }
                res.json({ success: true });
            });
        } else {
            res.status(404).json({ success: false, message: "Room not found" });
        }
    });
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
