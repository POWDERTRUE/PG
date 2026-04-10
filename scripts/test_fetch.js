async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "migeroro@gmail.com", password: "12345" })
    });
    const status = res.status;
    const body = await res.text();
    console.log("Status:", status);
    console.log("Body:", body);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
run();
