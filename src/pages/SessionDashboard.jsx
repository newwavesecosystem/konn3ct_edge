import React from 'react';

const attendanceData = [
  {
    id: 1,
    name: 'Odejinmi Samuel',
    time: 'Oct 2, 05:35:47 PM',
    onlineTime: '00:06:43',
    talkTime: '00:00:04',
    webcamTime: '00:06:17',
    messages: 3,
    reactions: 1,
    raiseHands: 4,
    activityScore: 2,
    status: 'Online',
  },
  {
    id: 2,
    name: 'Akanji Joseph',
    time: 'Oct 2, 05:50:00 PM',
    onlineTime: '00:06:43',
    talkTime: '00:00:04',
    webcamTime: '00:06:17',
    messages: 3,
    reactions: 1,
    raiseHands: 2,
    activityScore: 2,
    status: 'Online',
  },
];

function AttendancePanel() {
  return (
    <div className="min-h-screen  flex items-center justify-center p-6">
      <div className="bg-white border w-full max-w-5xl rounded-2xl p-6">
        <div className="grid grid-cols-9 text-xs font-semibold text-gray-500 border-b pb-2 mb-3">
          <div>User</div>
          <div>Online Time</div>
          <div>Talk Time</div>
          <div>Webcam Time</div>
          <div>Messages</div>
          <div>Reaction</div>
          <div>Raise Hands</div>
          <div>Activity Score</div>
          <div>Status</div>
        </div>

        {attendanceData.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-9 items-center text-sm text-gray-700 py-3 border-b last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">
                {user.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="font-medium text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">{user.time}</p>
              </div>
            </div>

            <div>{user.onlineTime}</div>
            <div>{user.talkTime}</div>
            <div>{user.webcamTime}</div>
            <div>{user.messages}</div>
            <div>😊 {user.reactions}</div>
            <div>✋ {user.raiseHands}</div>

            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500 rounded-full"
                  style={{ width: `${user.activityScore * 20}%` }}
                ></div>
              </div>
              <span className="text-xs">{user.activityScore}</span>
            </div>

            <div className="text-green-600 font-semibold text-xs">{user.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AttendancePanel;
