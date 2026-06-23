const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    console.log("Validating meeting 'Joso24j20'...");
    try {
        const req = await axios.post('https://dev.konn3ct.ng/api/app/kv4/validate-meeting', {
            name: "Joso24j20" // Using the room slug from myrooms
        }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log('VALIDATE RESPONSE:', JSON.stringify(req.data, null, 2));
    } catch (e) {
        console.error('VALIDATE ERROR:', e.response?.data || e.message);
    }
    
    console.log("Joining meeting 'Joso24j20'...");
    try {
        const req2 = await axios.post('https://dev.konn3ct.ng/api/app/kv4/join-room', {
            room: "Joso24j20",
            name: "Test User",
            email: "test@example.com"
        }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log('JOIN RESPONSE:', JSON.stringify(req2.data, null, 2).slice(0, 500));
    } catch (e) {
        console.error('JOIN ERROR:', e.response?.data || e.message);
    }

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
