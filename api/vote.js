import { airtable, listAll, VOTES_TABLE_ID, WORKS_TABLE_ID } from "./_airtable.js";

const MAX_VOTES = new Map([
  ["Рома", 10],
  ["Вика", 7],
  ["Арина", 10],
  ["Карина", 10],
  ["Андрей", 6]
]);

const normalizeUsername = value => String(value || "").trim().replace(/^@+/, "").toLowerCase();

function linkedWorkId(record) {
  const value = record?.fields?.["Contest Work"];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const voterName = String(req.body?.voterName || "").trim();
    const contestWork = String(req.body?.contestWork || "").trim();
    const action = req.body?.action;

    if (!MAX_VOTES.has(voterName)) {
      return res.status(400).json({ error: "Неизвестный голосующий" });
    }
    if (!contestWork || !["add", "delete"].includes(action)) {
      return res.status(400).json({ error: "Некорректный запрос" });
    }

    // Load the target work and current votes. Server, not UI, enforces the rules.
    const [work, votes] = await Promise.all([
      airtable(`${WORKS_TABLE_ID}/${encodeURIComponent(contestWork)}`),
      listAll(VOTES_TABLE_ID)
    ]);

    const ownVotes = votes.filter(v => v.fields?.["Voter Name"] === voterName);
    const exactVote = ownVotes.find(v => linkedWorkId(v) === contestWork);

    if (action === "delete") {
      if (!exactVote) {
        return res.status(200).json({ success: true, deleted: false });
      }
      await airtable(`${VOTES_TABLE_ID}/${exactVote.id}`, { method: "DELETE" });
      return res.status(200).json({ success: true, deleted: true });
    }

    if (exactVote) {
      return res.status(409).json({ error: "За эту работу голос уже отдан" });
    }

    if (ownVotes.length >= MAX_VOTES.get(voterName)) {
      return res.status(409).json({ error: "Лимит голосов исчерпан" });
    }

    const targetAuthor = normalizeUsername(work?.fields?.Username);
    if (!targetAuthor) {
      return res.status(400).json({ error: "У работы не указан автор" });
    }

    // Resolve only the already-voted works to enforce one vote per author.
    const votedWorkIds = [...new Set(ownVotes.map(linkedWorkId).filter(Boolean))];
    if (votedWorkIds.length) {
      const allWorks = await listAll(WORKS_TABLE_ID);
      const authorById = new Map(allWorks.map(item => [item.id, normalizeUsername(item.fields?.Username)]));
      const duplicateAuthor = votedWorkIds.some(id => authorById.get(id) === targetAuthor);
      if (duplicateAuthor) {
        return res.status(409).json({ error: "За этого автора уже отдан голос" });
      }
    }

    const created = await airtable(VOTES_TABLE_ID, {
      method: "POST",
      body: JSON.stringify({
        fields: {
          "Voter Name": voterName,
          "Contest Work": [contestWork],
          "Date/Time": new Date().toISOString()
        }
      })
    });

    return res.status(201).json({ success: true, record: created });
  } catch (error) {
    console.error("vote:", error);
    return res.status(502).json({ error: "Не удалось сохранить голос" });
  }
}
