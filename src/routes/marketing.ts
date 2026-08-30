import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { logger } from '../logger';
import { odooService } from '../services/odooService';

export const marketingRouter = Router();

const { OPENAI_API_KEY } = process.env;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || 'dummy-key-for-tests',
});

/**
 * 1. Campaign Planner Endpoint
 * Generates the proposed strategy and 30-day content plan without activating it.
 */
marketingRouter.post('/plan-campaign', async (req: Request, res: Response) => {
  try {
    const providedToken = req.query.token;
    const expectedToken = process.env.ODOO_WEBHOOK_SECRET || 'konn3ct-edge-ai-secret';
    if (providedToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task_id = req.body.id || req.body.task_id || req.body._id;
    const task_title = req.body.name || req.body.display_name || req.body.task_title;
    const existing_description = req.body.description || req.body.existing_description;

    if (!task_id || !task_title) {
      return res.status(400).json({ error: 'Missing task_id or task_title' });
    }

    logger.info(`Generating Campaign Strategy for: ${task_title}`);

    // AI Doctrine Prompt for Strategy
    const strategyPrompt = `
You are the Konn3ct Edge AI Chief Marketing Officer.
The Konn3ct Blueprint core values are: Connection Freedom, African-born global platform, Integrity, Friendliness, Customer-Centricity, Excellence.
Key product features: WebRTC Meetings, Webinars, Multiple screen sharing, built-in Polls, AI Summaries, Cloud Recording.
Primary KPIs: Free Users and Paid Users.

The Growth Manager has requested a new campaign: "${task_title}".

Output a valid JSON object containing:
1. "strategy_html": A highly detailed campaign brief formatted in HTML (using <b>, <ul>, <li>, <br>). Must include: Objective, Target Audience, Core Message, KPIs, and Budget Allocation recommendation.
2. "content_plan": An array of exactly 30 JSON objects representing a 30-day content calendar. Each object must have: 
   - "title": Short title of the content
   - "description": Instructions/format
   - "tags": Comma separated string of tags (e.g., "LinkedIn, Video")
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You output strict JSON. No markdown backticks." },
        { role: "user", content: strategyPrompt.trim() }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let aiReply = completion.choices[0].message.content || '{}';
    let aiData;
    try {
      aiData = JSON.parse(aiReply);
    } catch (e) {
      logger.error("Failed to parse Strategy JSON");
      return res.status(500).json({ error: 'AI failed to generate valid JSON' });
    }

    // Try to fetch Odoo sequence, fallback to Task ID
    let campaignId = await odooService.getNextSequence('konn3ct.marketing.campaign');
    if (!campaignId) {
      campaignId = `KE-MKT-${task_id}`;
    }

    const updatedTitle = `[${campaignId}] ${task_title}`;

    // Render the 30-day plan into HTML for the Growth Manager to review
    let contentPlanHtml = '<table border="1" style="width:100%; border-collapse: collapse;"><tr><th>Day</th><th>Title</th><th>Format/Tags</th></tr>';
    aiData.content_plan.forEach((item: any, idx: number) => {
      contentPlanHtml += `<tr><td>${idx+1}</td><td>${item.title}</td><td>${item.tags}</td></tr>`;
    });
    contentPlanHtml += '</table>';

    const formattedDescription = `
      <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #E35D6A; margin-bottom: 20px;">
        <b>GROWTH MANAGER INPUT</b><br/>
        ${existing_description ? existing_description : "<i>No manual description provided.</i>"}
      </div>
      <div style="border-top: 2px dashed #ccc; padding-top: 15px;">
        <b>🚀 AI-GENERATED CAMPAIGN STRATEGY</b><br/><br/>
        ${aiData.strategy_html}
      </div>
      <div style="margin-top: 20px;">
        <b>📅 PROPOSED 30-DAY CONTENT PLAN</b><br/><br/>
        ${contentPlanHtml}
      </div>
      <div style="display:none;" id="ai_internal_json">${JSON.stringify(aiData.content_plan)}</div>
    `;

    // Write Strategy to Odoo Task
    await odooService.updateTask(task_id, {
      name: updatedTitle, 
      description: formattedDescription,
      x_studio_traceability_id: campaignId 
    });

    logger.info(`Successfully generated Campaign ${campaignId} (Pending Activation)`);
    return res.status(200).json({ status: 'success', campaign_id: campaignId, message: 'Strategy drafted. Awaiting Human Approval.' });
  } catch (error: any) {
    logger.error('Error planning campaign:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 2. Campaign Activation Endpoint
 * Runs only after the Odoo Campaign reaches APPROVED, and creates the 30 child tasks.
 */
marketingRouter.post('/activate-campaign', async (req: Request, res: Response) => {
  try {
    const providedToken = req.query.token;
    const expectedToken = process.env.ODOO_WEBHOOK_SECRET || 'konn3ct-edge-ai-secret';
    if (providedToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task_id = req.body.id || req.body.task_id || req.body._id;
    const existing_description = req.body.description || req.body.existing_description;
    const task_title = req.body.name || req.body.task_title || '';

    if (!task_id || !existing_description) {
      return res.status(400).json({ error: 'Missing task_id or description' });
    }

    // Idempotency Check: Don't activate if already activated
    if (existing_description.includes('✅ CAMPAIGN ACTIVATED')) {
      return res.status(200).json({ status: 'skipped', message: 'Campaign already activated' });
    }

    // Extract the embedded JSON array from the description
    const jsonMatch = existing_description.match(/<div style="display:none;" id="ai_internal_json">(.*?)<\/div>/);
    if (!jsonMatch) {
      return res.status(400).json({ error: 'No 30-day plan JSON found in description' });
    }

    const contentPlan = JSON.parse(jsonMatch[1]);
    
    // Extract the Campaign Traceability ID from the title
    const idMatch = task_title.match(/\[(KE-MKT-[^\]]+)\]/);
    const campaignId = idMatch ? idMatch[1] : `KE-MKT-${task_id}`;

    // Create 30 child tasks in Odoo via OdooService
    for (let i = 0; i < contentPlan.length; i++) {
      const item = contentPlan[i];
      const childId = `${campaignId}-C${String(i + 1).padStart(2, '0')}`;
      
      await odooService.createTask({
        name: `[${childId}] ${item.title}`,
        description: item.description,
        project_id: req.body.project_id || false, // Should attach to the same project
        parent_id: task_id, // Link to parent campaign
        x_studio_traceability_id: childId
      });
    }

    // Mark Campaign as Activated to satisfy Idempotency
    const activatedDescription = existing_description + '<br/><br/><b>✅ CAMPAIGN ACTIVATED: 30 Child Tasks Generated</b>';
    await odooService.updateTask(task_id, { description: activatedDescription });

    logger.info(`Successfully activated Campaign ${campaignId} and created ${contentPlan.length} tasks`);
    return res.status(200).json({ status: 'success', message: 'Campaign Activated' });
  } catch (error: any) {
    logger.error('Error activating campaign:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 3. Content Studio Endpoint
 * Drafts platform-specific social copy based on a content task.
 */
marketingRouter.post('/draft-content', async (req: Request, res: Response) => {
  try {
    const providedToken = req.query.token;
    const expectedToken = process.env.ODOO_WEBHOOK_SECRET || 'konn3ct-edge-ai-secret';
    if (providedToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task_id = req.body.id || req.body.task_id || req.body._id;
    const task_title = req.body.name || req.body.display_name || req.body.task_title;
    const existing_description = req.body.description || req.body.existing_description;

    if (!task_id || !task_title) {
      return res.status(400).json({ error: 'Missing task_title' });
    }

    logger.info(`Drafting Social Content for: ${task_title}`);

    // AI Prompt with Strict Brand Blueprint Rules and Evidence Context
    const draftPrompt = `
You are the Konn3ct Edge Senior Copywriter.
The task title is a content request: "${task_title}".
Context: "${existing_description || 'None'}"

MANDATORY KONN3CT MARKETING RULES:
1. Every execution must support the Connection Freedom positioning and an approved Connection Freedom pillar. Do not force the phrase "Connection Freedom" into every post when a more audience-relevant expression of the underlying benefit is stronger.
2. Target one primary audience/job-to-be-done.
3. Use one primary messaging pillar.
4. Include one evidence-backed proof point where appropriate.
5. Use one clear CTA.
6. Adapt the execution specifically to each platform.
7. Do not invent product capabilities.
8. Clearly distinguish: currently available, beta, roadmap.
9. Prioritise useful/educational content over direct promotion.
10. Connect measurable content outcomes to acquisition, activation, conversion or retention.

PRODUCT EVIDENCE CONTEXT:
- Multiple Screen Sharing: AVAILABLE
- Webinars: AVAILABLE
- Cloud Recording: AVAILABLE
- In-Meeting Polls: AVAILABLE
- AI Meeting Assistant: BETA
- African Language Interpretation: ROADMAP (Claiming this is live is FORBIDDEN)

Generate the final, platform-optimized social media copy for this content piece. 
If the request asks for a feature that is UNVERIFIED or ROADMAP, you must label it "REQUIRES CONFIRMATION" and refuse to promote it as live.

Output a valid JSON object containing:
1. "platform": The target platform inferred from the title/description.
2. "draft_html": The actual drafted copy wrapped in HTML formatting for Odoo. Include relevant emojis and hashtags.
3. "creative_brief": HTML instructions for the graphic designer (dimensions, visual theme, text on image).
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You output strict JSON. No markdown backticks." },
        { role: "user", content: draftPrompt.trim() }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let aiReply = completion.choices[0].message.content || '{}';
    let aiData;
    try {
      aiData = JSON.parse(aiReply);
    } catch (e) {
      return res.status(500).json({ error: 'AI failed to generate valid JSON' });
    }

    const formattedDescription = `
      <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #1DA1F2; margin-bottom: 20px;">
        <b>📝 AI-DRAFTED COPY (${aiData.platform})</b><br/><br/>
        ${aiData.draft_html}
      </div>
      <div style="background-color: #FFF3CD; padding: 10px; border-left: 4px solid #FFC107;">
        <b>🎨 CREATIVE BRIEF FOR DESIGNER</b><br/><br/>
        ${aiData.creative_brief}
      </div>
      <br/>
      <i><small>Original Instructions: ${existing_description || task_title}</small></i>
    `;

    // Write Draft to Odoo Task via odooService
    await odooService.updateTask(task_id, { description: formattedDescription });

    logger.info(`Successfully drafted content for Task ${task_id}`);
    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    logger.error('Error drafting content:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 4. Analytics Engine
 * Weekly Marketing Intelligence analysis evaluating performance.
 */
marketingRouter.post('/analyze-results', async (req: Request, res: Response) => {
  try {
    const providedToken = req.query.token;
    const expectedToken = process.env.ODOO_WEBHOOK_SECRET || 'konn3ct-edge-ai-secret';
    if (providedToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Expecting metrics payload from Odoo
    const metricsPayload = req.body.metrics || req.body;

    const analysisPrompt = `
You are the Konn3ct Edge AI Analytics Engine.
Analyze the following Weekly Marketing Intelligence payload:
${JSON.stringify(metricsPayload, null, 2)}

Provide a highly structured analysis based on Free Users, Paid Users, and Conversions. 
Do NOT assume causation just from high impressions (e.g. Reach = 100k, Paid Users = 20 does NOT mean the reach caused the paid users unless attributed).

Output a valid JSON object containing:
1. "analysis_html": HTML formatted report containing exactly these sections:
   - 1. EXECUTIVE SUMMARY
   - 2. FREE USER PERFORMANCE (Target, Actual, Variance)
   - 3. PAID USER PERFORMANCE (Target, Actual, Variance)
   - 4. CHANNEL PERFORMANCE
   - 5. CAMPAIGN PERFORMANCE
   - 6. FUNNEL BLOCKERS
   - 7. SCALE
   - 8. TEST
   - 9. CHANGE
   - 10. STOP
   - 11. NEXT-WEEK RECOMMENDATION
   - 12. MANAGEMENT DECISIONS REQUIRED
   - 13. EVIDENCE / DATA LIMITATIONS
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You output strict JSON. No markdown backticks." },
        { role: "user", content: analysisPrompt.trim() }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(completion.choices[0].message.content || '{}');

    // In a real system, this could write to a specific CEO Dashboard object in Odoo
    logger.info("Successfully generated Weekly Marketing Intelligence");
    return res.status(200).json({ status: 'success', report: aiData.analysis_html });
  } catch (error: any) {
    logger.error('Error analyzing marketing results:', error);
    return res.status(500).json({ error: error.message });
  }
});
