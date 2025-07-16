const express = require("express");
const bodyParser = require("body-parser");
const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

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
    console.error(error);
    res.status(500).json({ status: "Error", message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
✨ Tạo file index.js cho backend Vô Ảnh
