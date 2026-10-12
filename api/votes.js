import { listAll, VOTES_TABLE_ID } from "./_airtable.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const records = await listAll(VOTES_TABLE_ID);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ records });
  } catch (error) {
    console.error("votes:", error);
    return res.status(502).json({ error: "Не удалось загрузить голоса" });
  }
}
