export default async function handler(req, res) {

  const token = process.env.AIRTABLE_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "TOKEN NOT FOUND"
    });
  }

  const response = await fetch(
    "https://api.airtable.com/v0/appSxQXkQdS7Z9V6b/tblw7e0Mp2HGsym5n",
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await response.json();

  res.status(200).json(data);
}
