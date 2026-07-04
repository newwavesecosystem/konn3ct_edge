const fs = require('fs');
const file = 'c:/conn3ct_meeting/recorder/index.js';
let content = fs.readFileSync(file, 'utf8');

// Update HTTP Server Chunk Handling
const oldHttpServer = `      if (req.method === 'POST' && req.url === '/chunk') {
        req.pipe(fileStream, { end: false });
        req.on('end', () => {
          res.writeHead(200);
          res.end('ok');
        });
      } else {
        res.writeHead(404);
        res.end('invalid');
      }`;

const newHttpServer = `      if (req.method === 'POST' && req.url === '/chunk') {
        const chunkIndex = parseInt(req.headers['x-chunk-index'] || '0');
        const chunkStart = req.headers['x-chunk-start'];
        
        let chunkSize = 0;
        req.on('data', chunk => {
          chunkSize += chunk.length;
          fileStream.write(chunk);
        });
        
        req.on('end', () => {
          const timestamp = Date.now();
          console.log(JSON.stringify({
            timestamp: new Date(timestamp).toISOString(),
            event: "recorder_chunk_received",
            recordingId: recordingId,
            chunkIndex,
            sizeBytes: chunkSize
          }));
          
          if (chunkSize === 0) {
            console.log(JSON.stringify({
              timestamp: new Date(timestamp).toISOString(),
              event: "recorder_chunk_empty",
              recordingId: recordingId,
              chunkIndex
            }));
          }
          
          res.writeHead(200);
          res.end('ok');
        });
      } else {
        res.writeHead(404);
        res.end('invalid');
      }`;

content = content.replace(oldHttpServer, newHttpServer);

// Update Browser fetch to pass headers
const oldFetch = `            if (e.data.size > 0) {
              // Chain the uploads to guarantee sequential arrival at the server
              window.uploadQueue = window.uploadQueue.then(() => 
                fetch(\`http://127.0.0.1:\${serverPort}/chunk\`, {
                  method: 'POST',
                  body: e.data
                }).catch(err => console.error("Chunk upload failed", err))
              );
            }`;

const newFetch = `            const currentChunkIndex = window.chunkIndex || 0;
            window.chunkIndex = currentChunkIndex + 1;
            const chunkStart = Date.now();
            
            // Chain the uploads to guarantee sequential arrival at the server
            window.uploadQueue = window.uploadQueue.then(() => 
              fetch(\`http://127.0.0.1:\${serverPort}/chunk\`, {
                method: 'POST',
                headers: {
                  'x-chunk-index': currentChunkIndex.toString(),
                  'x-chunk-start': chunkStart.toString()
                },
                body: e.data
              }).catch(err => console.error("Chunk upload failed", err))
            );`;

content = content.replace(oldFetch, newFetch);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated chunk manifest handling");
