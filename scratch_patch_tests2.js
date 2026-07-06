const fs = require('fs');

const testFile = 'c:/conn3ct_meeting/test/unit/server-integration.test.ts';
let content = fs.readFileSync(testFile, 'utf8');

const additionalTests = `
  it('allows co-host to broadcast poll creation successfully', async () => {
    return new Promise<void>((resolve, reject) => {
      // Client 1 (Viewer)
      const viewerToken = jwt.sign({ userId: 'viewer-1', email: 'viewer@conn3ct', name: 'Viewer', role: 'audience' }, 'dummy_secret');
      const wsViewer = new WebSocket(\`\${wsUrl}/signal?roomId=test-room-1&token=\${viewerToken}&participantId=part-viewer\`);
      
      wsViewer.on('open', () => {
        // Client 2 (Co-Host)
        const cohostToken = jwt.sign({ userId: 'cohost-2', email: 'cohost@conn3ct', name: 'Co-Host', role: 'co-host' }, 'dummy_secret');
        const wsCohost = new WebSocket(\`\${wsUrl}/signal?roomId=test-room-1&token=\${cohostToken}&participantId=part-cohost-2\`);
        
        wsViewer.on('message', (data: Buffer) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'poll_create') {
            expect(msg.question).toBe('Is the test working?');
            wsViewer.close();
            wsCohost.close();
            resolve();
          }
        });

        wsCohost.on('open', () => {
          // Send a poll create message
          wsCohost.send(JSON.stringify({ 
            type: 'poll_create', 
            pollId: 'poll-456',
            question: 'Is the test working?',
            options: ['Yes', 'No']
          }));
        });
      });
    });
  });
`;

// Insert before the last `});`
const lastCloseBraceIndex = content.lastIndexOf('});');
content = content.substring(0, lastCloseBraceIndex) + additionalTests + content.substring(lastCloseBraceIndex);

fs.writeFileSync(testFile, content, 'utf8');
console.log('Appended dedicated poll test');
