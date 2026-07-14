const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    console.log("Fetching rooms...");
    const req = await axios.get('https://dev.konn3ct.ng/api/app/rooms', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('ROOMS:', JSON.stringify(req.data).slice(0, 500));

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
