const axios = require('axios');

async function testLogin(baseURL, path, payload) {
    try {
        const url = `${baseURL}${path}`;
        console.log(`Trying ${url}...`);
        const res = await axios.post(url, payload);
        const token = res.data.token || res.data.data?.token || res.data.access_token;
        if (token) {
            console.log(`SUCCESS on ${url}`);
            return { token, baseURL };
        } else {
            console.log(`No token on ${url}`);
            if (res.data.twoFactorAuth) {
                console.log("Requires 2FA:", res.data);
            } else {
                console.log("Response:", res.data);
            }
            return null;
        }
    } catch(err) {
        console.log(`Failed on ${baseURL}${path} with status ${err.response?.status}`);
        return null;
    }
}

async function run() {
    const baseURL = 'https://govsupport.convergenceondemand.com/conferencing/api/app';
    const path = '/1gov/login';
    
    let token = null;

    const payload = {
        tenantId: "konnectsandbox",
        username: "odejinmisa@newwavesecosystem.com",
        password: "827xazLF6TBfD7N!"
    };

    const result = await testLogin(baseURL, path, payload);
    if (result) {
        token = result.token;
    } else {
        console.log("Could not log in");
        return;
    }

    console.log("\n--- Fetching Dashboard Stats ---");
    try {
        const statsRes = await axios.get(`${baseURL}/dashboard/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Dashboard stats response:");
        console.log(JSON.stringify(statsRes.data, null, 2));
    } catch(err) {
        console.error("Dashboard stats error:", err.response?.data || err.message);
    }

    console.log("\n--- Fetching My Rooms ---");
    try {
        const roomsRes = await axios.get(`${baseURL}/myrooms`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const resData = roomsRes.data;
        
        let output = {};
        if (resData) {
            for (let key in resData) {
                if (Array.isArray(resData[key])) {
                    output[key] = `[Array of ${resData[key].length} items]`;
                } else if (typeof resData[key] === 'object' && resData[key] !== null) {
                    output[key] = `{...}`;
                } else {
                    output[key] = resData[key];
                }
            }
        }
        console.log("Top level keys in myrooms response:", output);
        
        if (resData?.data) {
             let dataOutput = {};
             for (let key in resData.data) {
                if (Array.isArray(resData.data[key])) {
                    dataOutput[key] = `[Array of ${resData.data[key].length} items]`;
                } else if (typeof resData.data[key] === 'object' && resData.data[key] !== null) {
                    dataOutput[key] = `{...}`;
                } else {
                    dataOutput[key] = resData.data[key];
                }
             }
             console.log("Keys in res.data.data:", dataOutput);
             console.log("total_rooms in res.data:", resData.data.total_rooms);
             console.log("rooms in res.data length:", Array.isArray(resData.data.rooms) ? resData.data.rooms.length : resData.data.rooms);
        } else if (resData?.rooms) {
            console.log("total_rooms in root:", resData.total_rooms);
            console.log("rooms in root length:", Array.isArray(resData.rooms) ? resData.rooms.length : resData.rooms);
        }
        
    } catch(err) {
        console.error("Myrooms error:", err.response?.data || err.message);
    }
}

run();
