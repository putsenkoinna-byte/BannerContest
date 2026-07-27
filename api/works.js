export default async function handler(req, res) {
  try {
    const token = process.env.AIRTABLE_TOKEN;

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

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
