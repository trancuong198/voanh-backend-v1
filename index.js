require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { Client } = require("@notionhq/client");

const app = express();
const port = process.env.PORT || 3000;

// Khởi tạo Notion client với token từ biến môi trường
const notion = new Client({ auth: process.env.NOTION_API_KEY });

app.use(bodyParser.json());

app.post("/log", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_DATABASE_ID,
      },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: message,
              },
            },
          ],
        },
      },
    });

    res.status(200).json({ status: "Success", data: response });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ status: "Error", message: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});
