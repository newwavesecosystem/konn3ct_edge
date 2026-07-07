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
    
    const att = await axios.get(baseURL + '/meeting-attendance', {
      headers: { Authorization: 'Bearer ' + token }
    });
    
    const meetings = att.data.data.data;
    console.log('Got', meetings.length, 'meetings. Checking for participants...');
    let found = false;
    
    for (const m of meetings) {
      const room1 = m.room_info?.id;
      const room2 = m.id;
      const meeting1 = m.identifier;
      const meeting2 = m.meeting_id;
      const meeting3 = m.id;
      
      const combos = [
        [room1, meeting1], [room1, meeting2], [room1, meeting3],
        [room2, meeting1], [room2, meeting2], [room2, meeting3]
      ];
      
      for (const [r, mid] of combos) {
        if (!r || !mid) continue;
        try {
          const det = await axios.get(baseURL + '/attendance-details/' + r + '/' + mid, {
            headers: { Authorization: 'Bearer ' + token }
          });
          const arr = det.data?.data?.data || det.data?.data || det.data;
          if (Array.isArray(arr) && arr.length > 0) {
            console.log('FOUND participants for meeting', m.id, 'with room', r, 'and meetingId', mid);
            console.log(JSON.stringify(arr[0], null, 2));
            found = true;
          }
        } catch (e) {}
      }
    }
    
    if (!found) {
      console.log('NO PARTICIPANTS FOUND for any of the first page meetings.');
    }

  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
