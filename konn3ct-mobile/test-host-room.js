const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    const roomsReq = await axios.get('https://dev.konn3ct.ng/api/app/myrooms', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const rooms = roomsReq.data.data.rooms;
    if (rooms.length === 0) return console.log("No rooms found");
    const roomId = rooms[0].id;
    
    console.log("Creating schedule...");
    const createReq = await axios.post('https://dev.konn3ct.ng/api/app/schedule', {
        title: "Test Schedule",
        description: "Testing",
        room_id: roomId,
        recurrence: "once",
        date: "2026-06-25",
        fromtime: "10:00",
        totime: "11:00",
        timezone: "UTC",
        guest: "test@example.com"
    }, {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('CREATE SCHEDULE RESPONSE:', JSON.stringify(createReq.data, null, 2));

    const req = await axios.get('https://dev.konn3ct.ng/api/app/schedule', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('SCHEDULES RESPONSE:', JSON.stringify(req.data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
