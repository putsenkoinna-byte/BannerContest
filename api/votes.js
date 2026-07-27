export default async function handler(req, res) {

  const token = process.env.AIRTABLE_TOKEN;

  const baseId = "appSxQXkQdS7Z9V6b";
  const tableId = "tblbzFEy8wRU63bv1";

  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}`,
    {
      headers:{
        Authorization:`Bearer ${token}`
      }
    }
  );

  const data = await response.json();

  res.status(200).json(data);
}
