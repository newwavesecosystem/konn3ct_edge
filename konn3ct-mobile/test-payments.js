const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('https://dev.konn3ct.ng/api/app/login', {
      username: 'attehkayode12@gmail.com',
      password: 'testuser'
    });
    const token = login.data.token || login.data.data?.token || login.data.access_token;
    
    console.log("Fetching payments...");
    const pay = await axios.get('https://dev.konn3ct.ng/api/app/payments', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('PAYMENTS:', JSON.stringify(pay.data).substring(0, 500) + '...');

    console.log("Fetching pricing plans...");
    const plans = await axios.get('https://dev.konn3ct.ng/api/app/pricing-plans', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('PLANS:', JSON.stringify(plans.data).substring(0, 1500) + '...');

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
