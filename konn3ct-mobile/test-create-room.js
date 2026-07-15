const axios = require('axios');

async function testCreateRoom() {
    const baseURL = 'https://govsupport.convergenceondemand.com/conferencing/api/app';
    const loginPayload = {
        tenantId: "konnectsandbox",
        username: "odejinmisa@newwavesecosystem.com",
        password: "827xazLF6TBfD7N!"
    };

    try {
        console.log("Logging in...");
        const loginRes = await axios.post(`${baseURL}/1gov/login`, loginPayload);
        const token = loginRes.data.token || loginRes.data.data?.token || loginRes.data.access_token;

        if (!token) {
            console.log("No token received");
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // 1. Create a room
        const roomName = 'Test Room ' + Math.floor(Math.random() * 1000);
        const roomUrl = 'testroom' + Math.floor(Math.random() * 10000);
        
        console.log(`\nCreating room: ${roomName} (${roomUrl})`);
        
        const payload = {
            name: roomName,
            url: roomUrl,
            mode: 'meeting',
            privacy: 0
        };

        const createRes = await axios.post(`${baseURL}/createroom`, payload, { headers });
        console.log("Create Response:");
        console.log(JSON.stringify(createRes.data, null, 2));

        // 2. Fetch myrooms
        console.log("\nFetching /myrooms...");
        const myRoomsRes = await axios.get(`${baseURL}/myrooms`, { headers });
        
        const rooms = myRoomsRes.data.data?.rooms || myRoomsRes.data.rooms || [];
        console.log(`Fetched ${rooms.length} rooms.`);
        
        const found = rooms.find(r => r.url === roomUrl || r.name === roomName);
        if (found) {
            console.log("SUCCESS! Found the newly created room in /myrooms:");
            console.log(JSON.stringify(found, null, 2));
        } else {
            console.log("ERROR: The newly created room was NOT found in the /myrooms response!");
            console.log("Rooms returned:");
            rooms.forEach(r => console.log(` - ${r.name} (${r.url})`));
            console.log("\nFull response data:");
            console.log(JSON.stringify(myRoomsRes.data.data || myRoomsRes.data, null, 2));
        }

    } catch (err) {
        console.error("Error:", err.response?.data || err.message);
    }
}

testCreateRoom();
