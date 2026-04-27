import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:3000/health")
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus("Error"));
  }, []);

  return (
    <div>
      <h1>Backend status: {status}</h1>
    </div>
  );
}

export default App;
