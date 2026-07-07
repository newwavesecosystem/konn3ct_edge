const axios = require('axios');

async function test() {
  const baseURL = 'https://govsupport.convergenceondemand.com/conferencing/api/app';
  try {
    const login = await axios.post(baseURL + '/1gov/login', {
      tenantId: 'konnectsandbox',
      username: 'odejinmisa@newwavesecosystem.com',
      password: '827xazLF6TBfD7N!'
    });
    
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    console.log('Login successful! Token:', token ? 'exists' : 'missing');
    
    const att = await axios.get(baseURL + '/meeting-attendance', {
      headers: { Authorization: 'Bearer ' + token }
    });
    
    console.log('ATTENDANCE RESPONSE:', JSON.stringify(att.data, null, 2));

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
