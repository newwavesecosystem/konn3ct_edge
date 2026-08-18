import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { logger } from '../logger';

export const odooRouter = Router();

const { ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY, OPENAI_API_KEY } = process.env;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || 'dummy-key-for-tests',
});

async function jsonRpcCall(service: string, method: string, args: any[]) {
  if (!ODOO_URL) throw new Error("ODOO_URL is missing in environment");
  
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: service,
      method: method,
      args: args
    }
  };

  const response = await fetch(`${ODOO_URL.replace(/\/$/, '')}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = (await response.json()) as any;
  if (data.error) {
    throw new Error(`Odoo API Error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

odooRouter.post('/task/elaborate', async (req: Request, res: Response) => {
  try {
    // Basic security token check from query param
    const providedToken = req.query.token;
    const expectedToken = process.env.ODOO_WEBHOOK_SECRET || 'konn3ct-edge-ai-secret';
    
    if (providedToken !== expectedToken) {
      logger.warn('Unauthorized webhook request from Odoo');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Safely extract Odoo's native fields or custom mapped fields
    const task_id = req.body.id || req.body.task_id;
    const task_title = req.body.name || req.body.task_title;
    const existing_description = req.body.description || req.body.existing_description;

    if (!task_id || !task_title) {
      return res.status(400).json({ error: 'Missing task_id or task_title' });
    }

    logger.info(`Received Odoo webhook for task ${task_id}: ${task_title}`);

    // Prevent re-processing if the AI signature is already there
    if (existing_description && existing_description.includes('AI-GENERATED EXECUTION BRIEF')) {
      logger.info(`Task ${task_id} already has an AI brief. Skipping.`);
      return res.status(200).json({ status: 'skipped', message: 'AI brief already exists' });
    }

    // AI Doctrine Prompt
    const doctrinePrompt = `
You are the Konn3ct Edge AI Project Management Engineer. Your responsibility is to convert short management instructions into engineering-ready work packages. Every task must maintain traceability between: Strategy -> Business Objective -> Project -> Requirement -> Engineering Task. 

Given the task title, generate a professional implementation brief. 
Return HTML only (using <b>, <ul>, <li>, <br>). Do not use markdown backticks.

Required structure:
<b>1. Task Summary</b><br/>
<b>2. Business Context</b><br/>
<b>3. Objective & Scope</b><br/>
<b>4. Functional Requirements</b><br/>
<b>5. Technical & Security Considerations</b><br/>
<b>6. Acceptance Criteria (Must be measurable/testable)</b><br/>
<b>7. Definition of Done & QA Evidence Required</b><br/><br/>

Do not invent APIs or architectures not provided. If unknown, identify as "Requires Confirmation".

Task Title: ${task_title}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are the Konn3ct Edge AI Project Management Engineer." },
        { role: "user", content: doctrinePrompt.trim() }
      ],
      temperature: 0.7,
    });

    let aiReply = completion.choices[0].message.content || '';
    if (aiReply.startsWith("```html")) aiReply = aiReply.substring(7);
    if (aiReply.endsWith("```")) aiReply = aiReply.substring(0, aiReply.length - 3);

    const formattedDescription = `
      <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #005A9C; margin-bottom: 20px;">
        <b>MANAGEMENT INPUT</b><br/>
        ${existing_description ? existing_description : "<i>No manual description provided. Title used as primary directive.</i>"}
      </div>
      <div style="border-top: 2px dashed #ccc; padding-top: 15px;">
        <b>🤖 AI-GENERATED EXECUTION BRIEF</b><br/><br/>
        ${aiReply.trim()}
      </div>
    `;

    // Authenticate with Odoo
    if (!ODOO_DB || !ODOO_USER || !ODOO_API_KEY) {
      throw new Error("Missing Odoo credentials in environment variables");
    }
    
    const uid = await jsonRpcCall('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]);
    if (!uid) throw new Error("Odoo authentication failed");

    // Write back to Odoo
    await jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'project.task', 'write',
      [[task_id], { description: formattedDescription }]
    ]);

    logger.info(`Successfully elaborated Odoo task ${task_id}`);
    return res.status(200).json({ status: 'success', message: 'Task elaborated' });
  } catch (error: any) {
    logger.error('Error elaborating Odoo task:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});
