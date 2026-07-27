export default async function handler(req, res) {

  const token = process.env.AIRTABLE_TOKEN;

  const baseId = "appSxQXkQdS7Z9V6b";
  const tableId = "tblbzFEy8wRU63bv1";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { voterName, contestWork, action } = req.body;

  if (action === "add") {

    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    return res.status(200).json(data);
  }


  if (action === "delete") {

    const find = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula={Voter Name}="${voterName}"`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const votes = await find.json();

    if (votes.records.length) {

      await fetch(
        `https://api.airtable.com/v0/${baseId}/${tableId}/${votes.records[0].id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
    }

    return res.status(200).json({success:true});
  }

}
