#!/usr/bin/env node

require('dotenv').config();

const { ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY, OPENAI_API_KEY } = process.env;

if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_API_KEY || !OPENAI_API_KEY) {
  console.error("❌ Missing required environment variables. Ensure ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY, and OPENAI_API_KEY are in your .env file.");
  process.exit(1);
}

async function jsonRpcCall(service, method, args) {
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
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`Odoo API Error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function authenticate() {
  const uid = await jsonRpcCall('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]);
  if (!uid) {
    throw new Error("❌ Authentication failed. Check Odoo credentials.");
  }
  return uid;
}

async function elaborateTask(taskName, existingDescription) {
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

Task Title: ${taskName}
  `;
  
  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are the Konn3ct Edge AI Project Management Engineer." },
      { role: "user", content: doctrinePrompt.trim() }
    ],
    temperature: 0.7
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`OpenAI API Error: ${data.error.message}`);
  }

  let aiReply = data.choices[0].message.content;
  if (aiReply.startsWith("```html")) aiReply = aiReply.substring(7);
  if (aiReply.endsWith("```")) aiReply = aiReply.substring(0, aiReply.length - 3);
  
  // Implement the brilliant ChatGPT suggestion: Separate Management Input from AI Output
  const formattedDescription = `
    <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #005A9C; margin-bottom: 20px;">
      <b>MANAGEMENT INPUT</b><br/>
      ${existingDescription ? existingDescription : "<i>No manual description provided. Title used as primary directive.</i>"}
    </div>
    <div style="border-top: 2px dashed #ccc; padding-top: 15px;">
      <b>🤖 AI-GENERATED EXECUTION BRIEF</b><br/><br/>
      ${aiReply.trim()}
    </div>
  `;

  return formattedDescription;
}

async function run() {
  try {
    console.log("🔐 Authenticating with Odoo...");
    const uid = await authenticate();
    console.log("✅ Authenticated successfully.");

    console.log("🔍 Searching for tasks needing AI elaboration...");
    // Fetch tasks that don't have the AI signature yet, but have a title. 
    // For safety, we only grab up to 5 tasks at a time that don't contain "AI-GENERATED EXECUTION BRIEF"
    const tasks = await jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'project.task', 'search_read',
      [[['description', 'not ilike', 'AI-GENERATED EXECUTION BRIEF']]],
      { fields: ['id', 'name', 'description'], limit: 5 }
    ]);

    // Filter down to tasks that are essentially empty or very short, so we don't overwrite manual massive docs
    const tasksToProcess = tasks.filter(t => !t.description || t.description.length < 150);

    if (tasksToProcess.length === 0) {
      console.log("👍 No tasks require AI elaboration right now. Nothing to do!");
      return;
    }

    console.log(`📋 Found ${tasksToProcess.length} task(s) to process.`);

    for (const task of tasksToProcess) {
      console.log(`\n🤖 Asking AI to elaborate on: "${task.name}"...`);
      const newDescription = await elaborateTask(task.name, task.description);
      
      console.log(`💾 Saving generated brief back to Odoo Task ID ${task.id}...`);
      await jsonRpcCall('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'project.task', 'write',
        [[task.id], { description: newDescription }]
      ]);
      console.log(`✅ Task ID ${task.id} updated successfully!`);
    }

    console.log("\n🎉 Automation cycle complete!");
  } catch (error) {
    console.error("❌ Process failed:", error.message);
  }
}

run();
