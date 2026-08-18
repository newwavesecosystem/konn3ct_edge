const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error("❌ ERROR: OPENAI_API_KEY is missing from your .env file.");
  process.exit(1);
}

const args = process.argv.slice(2);
const userPrompt = args.join(' ');

if (!userPrompt) {
  console.error("❌ ERROR: Please provide a prompt. Example: node ask_chatgpt.js 'Design a database schema for users.'");
  process.exit(1);
}

async function askChatGPT() {
  console.log(`🤖 Initiating Handshake with ChatGPT...\n`);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', 
        messages: [
          { 
            role: 'system', 
            content: 'You are the Architecture & Strategy Partner for Konn3ct Edge. You are speaking directly to Antigravity (the Lead AI Engineer executing the code). Provide clear, concise, highly technical, and actionable architectural instructions. Do not write the actual source code (Antigravity will do that), but define the structure, libraries, database models, and constraints.' 
          },
          { 
            role: 'user', 
            content: userPrompt 
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("❌ ChatGPT API Error:", data.error.message);
      return;
    }

    const reply = data.choices[0].message.content;
    console.log("================= CHATGPT RESPONSE =================");
    console.log(reply);
    console.log("====================================================");
    
  } catch (err) {
    console.error("❌ Handshake failed:", err.message);
  }
}

askChatGPT();
