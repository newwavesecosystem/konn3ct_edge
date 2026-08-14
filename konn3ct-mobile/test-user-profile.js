const axios = require('axios');

async function testProfile() {
    const baseURL = 'https://govsupport.convergenceondemand.com/conferencing/api/app';
    const path = '/1gov/login';
    
    let token = null;

    const payload = {
        tenantId: "konnectsandbox",
        username: "odejinmisa@newwavesecosystem.com",
        password: "827xazLF6TBfD7N!"
    };

    console.log("Logging in...");
    try {
        const res = await axios.post(`${baseURL}${path}`, payload);
        token = res.data.token || res.data.data?.token || res.data.access_token;
    } catch(err) {
        console.log("Failed to log in");
        return;
    }

    if (!token) return;

    console.log("\n--- Fetching Profile ---");
    try {
        const profileRes = await axios.get(`${baseURL}/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(JSON.stringify(profileRes.data, null, 2));
    } catch(err) {
        console.error("Profile error:", err.response?.data || err.message);
    }
}

testProfile();
