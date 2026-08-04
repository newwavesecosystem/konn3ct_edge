const axios = require('axios');

async function testGovEvents() {
  try {
    console.log("Logging in...");
    const loginRes = await axios.post('https://govsupport.convergenceondemand.com/conferencing/api/app/1gov/login', {
      tenantId: 'konnectsandbox',
      username: 'odejinmisa@newwavesecosystem.com',
      password: '827xazLF6TBfD7N!'
    });
    
    const token = loginRes.data.token || (loginRes.data.data && loginRes.data.data.token);
    
    if (!token) {
        console.log("Login failed, no token:", loginRes.data);
        return;
    }
    
    console.log("Login successful! Fetching events...");
    const eventRes = await axios.get('https://govsupport.convergenceondemand.com/conferencing/api/app/event-list', {
      headers: { Authorization: 'Bearer ' + token }
    });
    
    console.log("EVENTS RESPONSE:");
    console.log(JSON.stringify(eventRes.data, null, 2));

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
testGovEvents();
