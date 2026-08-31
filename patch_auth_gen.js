const fs = require('fs');

let supCode = fs.readFileSync('src/signaling/supervisor.ts', 'utf8');

// Replace the job queuing logic in supervisor to set current worker generation
const supOld = `await redis.set(\`recording:\${rec.id}:control\`, 'RECOVERING');`;
const supNew = `await redis.set(\`recording:\${rec.id}:control\`, 'RECOVERING');
                 
                 const currentMaxSegment = await db.recordingSegment.findFirst({
                   where: { recordingId: rec.id },
                   orderBy: { workerGeneration: 'desc' }
                 });
                 const nextWorkerGeneration = (currentMaxSegment?.workerGeneration || 0) + 1;
                 
                 // Authoritative current worker generation in Redis
                 await redis.set(\`recording:\${rec.id}:current-worker-generation\`, nextWorkerGeneration);
                 `;
supCode = supCode.replace(supOld, supNew);
fs.writeFileSync('src/signaling/supervisor.ts', supCode);

let routesCode = fs.readFileSync('src/routes/recordings.ts', 'utf8');

const routesOld = `    const maxGenSeg = await db.recordingSegment.findFirst({
      where: { recordingId: id },
      orderBy: { workerGeneration: 'desc' }
    });
    
    if (maxGenSeg && (workerGeneration || 1) < maxGenSeg.workerGeneration) {
        return res.status(409).json({ error: 'Stale worker generation rejected completely' });
    }`;

const routesNew = `    const redis = require('../config/redis').redis;
    const authGenStr = await redis.get(\`recording:\${id}:current-worker-generation\`);
    if (authGenStr) {
        const authGen = parseInt(authGenStr, 10);
        if ((workerGeneration || 1) < authGen) {
            return res.status(409).json({ error: 'Stale worker generation rejected completely. Authoritative is ' + authGen });
        }
    }`;
routesCode = routesCode.replace(routesOld, routesNew);
fs.writeFileSync('src/routes/recordings.ts', routesCode);
