#!/usr/bin/env node

/**
 * Odoo CI/CD Integration Script
 * Handles PR verification, posting evidence, and creating defects.
 */

const { ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY } = process.env;

// Parse args
const argv = {};
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    argv[process.argv[i].substring(2)] = process.argv[i + 1];
  }
}

const action = argv['action'];
const prTitle = argv['pr-title'] || '';
const branchName = argv['branch-name'] || '';
const buildStatus = argv['build-status'] || '';
const repo = argv['repo'] || '';
const runId = argv['run-id'] || '';
const commitSha = argv['commit-sha'] || '';
const commitMessage = argv['commit-message'] || '';
const author = argv['author'] || 'Unknown';
const successStage = argv['success-stage'] || '';

// The pattern matching the Blueprint Traceability IDs (e.g., KE-V06-MEDIA-REQ-001)
const ID_REGEX = /KE-[A-Z0-9]+-[A-Z]+-[A-Z]+-\d+/i;

function extractId(text1, text2, text3) {
  const match = (text1 || '').match(ID_REGEX) || (text2 || '').match(ID_REGEX) || (text3 || '').match(ID_REGEX);
  return match ? match[0].toUpperCase() : null;
}

async function jsonRpcCall(service, method, args) {
  if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_API_KEY) {
    console.error("Missing Odoo credentials in environment variables.");
    process.exit(1);
  }

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
    throw new Error("Authentication failed. Check credentials.");
  }
  return uid;
}

async function verifyPr() {
  const id = extractId(prTitle, branchName, commitMessage);
  if (!id) {
    console.error(`❌ PR Verification Failed: No valid Odoo Traceability ID found in branch (${branchName}) or title (${prTitle}).`);
    console.error(`Expected format: KE-VXX-DOMAIN-TYPE-000 (e.g., KE-V06-MEDIA-REQ-001)`);
    process.exit(1);
  }
  console.log(`✅ PR Verification Passed: Found Traceability ID ${id}`);
  process.exit(0);
}

async function postEvidence() {
  const id = extractId(prTitle, branchName, commitMessage);
  if (!id) {
    console.log("No Traceability ID found. Skipping evidence post.");
    return;
  }
  
  try {
    const uid = await authenticate();
    
    // Find the task by ID
    const taskIds = await jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'project.task', 'search',
      [[
        '|',
        ['x_studio_traceability_id', '=', id],
        ['name', 'ilike', id]
      ]]
    ]);
    
    if (!taskIds || taskIds.length === 0) {
      console.log(`Could not find task with ID ${id} in Odoo. Skipping evidence post.`);
      return;
    }
    
    const taskId = taskIds[0];
    const message = `
      <b>CI/CD Build Evidence</b><br/>
      Status: <b>${buildStatus}</b><br/>
      Repository: ${repo}<br/>
      Commit: ${commitSha}<br/>
      Run ID: ${runId}<br/>
      <a href="https://github.com/${repo}/actions/runs/${runId}">View Actions Log</a>
    `;
    
    await jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'mail.message', 'create',
      [{
        model: 'project.task',
        res_id: taskId,
        body: message,
        message_type: 'comment',
        subtype_id: 1 // Note
      }]
    ]);
    
    console.log(`✅ Evidence posted to Odoo Task ID ${id}`);
    
    // Automatically move Kanban stage if build was successful
    if (successStage && buildStatus === 'success') {
      const stages = await jsonRpcCall('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'project.task.type', 'search_read',
        [[['name', 'ilike', successStage]]],
        { fields: ['id', 'name'], limit: 1 }
      ]);
      
      if (stages && stages.length > 0) {
        const stageId = stages[0].id;
        await jsonRpcCall('object', 'execute_kw', [
          ODOO_DB, uid, ODOO_API_KEY,
          'project.task', 'write',
          [[taskId], { stage_id: stageId }]
        ]);
        console.log(`🔄 Task automatically moved to stage: ${stages[0].name}`);
      } else {
        console.log(`⚠️ Kanban stage matching '${successStage}' not found in Odoo. Skipping stage transition.`);
      }
    }

  } catch (error) {
    console.error("Failed to post evidence to Odoo:", error);
  }
}

async function createDefect() {
  try {
    const uid = await authenticate();
    
    const description = `
      <b>Automated Defect Report</b><br/>
      A critical CI/CD pipeline failed on branch ${branchName}.<br/>
      Repository: ${repo}<br/>
      Author: ${author}<br/>
      Commit: ${commitSha}<br/>
      <a href="https://github.com/${repo}/actions/runs/${runId}">View Actions Log</a>
    `;
    
    const taskId = await jsonRpcCall('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'project.task', 'create',
      [{
        name: `[CI Failure] ${repo} - ${branchName}`,
        description: description,
        project_id: 46
      }]
    ]);
    
    console.log(`✅ Automated defect created in Odoo (Task ID: ${taskId})`);
  } catch (error) {
    console.error("Failed to create defect in Odoo:", error);
  }
}

async function main() {
  if (action === 'verify_pr') {
    await verifyPr();
  } else if (action === 'post_evidence') {
    await postEvidence();
  } else if (action === 'create_defect') {
    await createDefect();
  } else {
    console.error("Unknown action:", action);
    process.exit(1);
  }
}

main();
