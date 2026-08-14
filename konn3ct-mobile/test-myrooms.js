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
    console.log(JSON.stringify(roomsReq.data, null, 2).slice(0, 500));

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
