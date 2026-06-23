const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    console.log("Creating room...");
    try {
        const req = await axios.post('https://dev.konn3ct.ng/api/app/createroom', {
            name: "Instant Mobile Test",
            url: "instmob" + Math.floor(Math.random() * 10000),
            mode: "meeting",
            privacy: 1,
            color: "#ffffff",
            access_code: ""
        }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log('CREATE ROOM RESPONSE:', JSON.stringify(req.data, null, 2));

        if (req.data.room) {
           console.log("Starting room...");
           const startReq = await axios.get(`https://dev.konn3ct.ng/api/app/start-a-room/${req.data.room.id}`, {
             headers: { Authorization: 'Bearer ' + token }
           });
           console.log('START ROOM RESPONSE:', JSON.stringify(startReq.data, null, 2).slice(0, 300));
        } else if (req.data.data) {
           // Maybe the room object is inside data?
           console.log("Room ID might be:", req.data.data.id);
        }
    } catch (err) {
        console.error('CREATE ERROR:', err.response?.data || err.message);
    }
  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
