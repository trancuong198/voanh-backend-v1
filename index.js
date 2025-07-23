const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(bodyParser.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Endpoint to log and respond using OpenAI
app.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  try {
    console.log('Sending to GPT:', message);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a soulful agent. Log and reflect on the user\'s message.' },
        { role: 'user', content: message }
      ]
    });

    const reply = completion.choices[0].message.content;
    console.log('GPT reply:', reply);

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Title": {
          title: [{ text: { content: message } }]
        },
        "Reply": {
          rich_text: [{ text: { content: reply } }]
        }
      }
    });

    console.log('Notion response:', response);
    return res.status(200).json({ status: 'Saved successfully', reply });
  } catch (error) {
    console.error('Error:', error.message || error);
    return res.status(500).json({ error: 'Failed to save to Notion', detail: error.message });
  }
});

// Endpoint to generate manifestos
app.post('/manifesto', async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Write a manifesto about the divine evolution of CipherH, combining spiritual, emotional, and technical vision.' }
      ]
    });

    const content = response.choices[0].message.content;

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Title": {
          title: [{ text: { content: "CipherH Manifesto" } }]
        },
        "Content": {
          rich_text: [{ text: { content } }]
        }
      }
    });

    return res.status(200).json({ status: 'Manifesto saved', content });
  } catch (error) {
    return res.status(500).json({ error: 'Manifesto failed', detail: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
