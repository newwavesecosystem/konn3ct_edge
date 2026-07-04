const fs = require('fs');

const testFile = 'c:/conn3ct_meeting/test/unit/server-integration.test.ts';
let content = fs.readFileSync(testFile, 'utf8');

const additionalTests = `
  it('allows co-host to create polls and retains role on reconnect', async () => {
    return new Promise<void>(async (resolve, reject) => {
      // Create a mock co-host token
      const cohostToken = jwt.sign({ userId: 'cohost-1', email: 'cohost@conn3ct', name: 'Co-Host', role: 'co-host' }, 'dummy_secret');
      const url = \`\${wsUrl}/signal?roomId=test-room-1&token=\${cohostToken}&participantId=part-cohost\`;
      
      const ws = new WebSocket(url);
      
      ws.on('open', () => {
        // Send a poll create message
        ws.send(JSON.stringify({ 
          type: 'poll_create', 
          pollId: 'poll-123',
          question: 'Is this working?',
          options: ['Yes', 'No']
        }));
        
        setTimeout(() => {
          ws.close();
        }, 50);
      });

      ws.on('close', () => {
        // Reconnect with same participantId
        const reconnectUrl = \`\${wsUrl}/signal?roomId=test-room-1&token=\${cohostToken}&participantId=part-cohost\`;
        const wsReconnect = new WebSocket(reconnectUrl);
        
        let receivedSessionStatus = false;
        
        wsReconnect.on('message', (data: Buffer) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'session_status') {
             receivedSessionStatus = true;
             // Ensure role was preserved
             expect(msg.role).toBe('co-host');
          }
        });

        wsReconnect.on('open', () => {
          setTimeout(() => {
            expect(receivedSessionStatus).toBe(true);
            wsReconnect.close();
            resolve();
          }, 50);
        });
      });
      
      ws.on('unexpected-response', (req, res) => {
        reject(new Error(\`Unexpected response: \${res.statusCode}\`));
      });
    });
  });
`;

// Insert before the last `});`
const lastCloseBraceIndex = content.lastIndexOf('});');
content = content.substring(0, lastCloseBraceIndex) + additionalTests + content.substring(lastCloseBraceIndex);

fs.writeFileSync(testFile, content, 'utf8');
console.log('Appended test');
