const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    console.log("Fetching referees...");
    const referees = await axios.get('https://dev.konn3ct.ng/api/app/referee', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('REFEREES:', JSON.stringify(referees.data, null, 2));

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
