export default async function handler(req, res) {

  const token = process.env.AIRTABLE_TOKEN;

  const baseId = "appSxQXkQdS7Z9V6b";
  const tableId = "tblbzFEy8wRU63bv1";

  if (req.method !== "POST") {
    return res.status(405).json({error:"Method not allowed"});
  }

  const { voterName, contestWork } = req.body;

  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          "Voter Name": voterName,
          "Contest Work": [contestWork],
          "Date/Time": new Date().toISOString()
        }
      })
    }
  );

  const data = await response.json();

  res.status(200).json(data);
}
