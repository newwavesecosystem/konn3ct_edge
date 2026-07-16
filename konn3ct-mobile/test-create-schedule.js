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
      console.log("No rooms found, can't schedule.");
      return;
    }
    const roomId = rooms[0].id;

    console.log("Creating schedule with room id:", roomId);
    try {
        const req = await axios.post('https://dev.konn3ct.ng/api/app/schedule', {
            title: "Test Session 1",
            description: "Test description",
            room_id: roomId,
            recurrence: "once",
            date: "2026-06-25",
            fromtime: "15:00",
            totime: "16:00",
            timezone: "Africa/Lagos",
            guest: "test@example.com"
        }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log('SCHEDULE CREATED:', JSON.stringify(req.data, null, 2));
    } catch (createErr) {
        console.error('CREATE ERROR:', createErr.response?.data || createErr.message);
    }
    
    console.log("Fetching schedule...");
    const schedReq = await axios.get('https://dev.konn3ct.ng/api/app/schedule', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('SCHEDULE LIST:', JSON.stringify(schedReq.data, null, 2));

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
