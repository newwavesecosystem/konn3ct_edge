const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    console.log("Fetching my rooms...");
    const roomsReq = await axios.get('https://dev.konn3ct.ng/api/app/myrooms', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const rooms = roomsReq.data.data.rooms;
    if (!rooms || rooms.length === 0) {
      console.log("No rooms found, can't join.");
      return;
    }
    const room = rooms[0];

    console.log("Joining room:", room.id);
    try {
        const req = await axios.post('https://dev.konn3ct.ng/api/app/join-room', {
            id: room.id,
            name: "Sammy",
            email: "odejinmisamuel@gmail.com"
        }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log('JOIN RESPONSE:', JSON.stringify(req.data, null, 2).slice(0, 500));
    } catch (joinErr) {
        console.error('JOIN ERROR:', joinErr.response?.data || joinErr.message);
    }
    
    console.log("Starting room:", room.id);
    try {
        const startReq = await axios.get(`https://dev.konn3ct.ng/api/app/start-a-room/${room.id}`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log('START RESPONSE:', JSON.stringify(startReq.data, null, 2).slice(0, 500));
    } catch (startErr) {
        console.error('START ERROR:', startErr.response?.data || startErr.message);
    }

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
